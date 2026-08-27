import os
import json
import base64
import hashlib
import secrets
import time
from typing import Optional, Dict, Any
from datetime import datetime
import httpx
from sqlmodel import Session, select

from app.config import settings
from app.models import Lead, EmailMessage, LeadStatus, EmailDirection, MessageChannel

TOKEN_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "x_token.json")
STATE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".x_oauth_state.json")

def generate_pkce_pair() -> tuple[str, str]:
    """Generates code_verifier and code_challenge (S256) for OAuth 2.0 PKCE."""
    code_verifier = secrets.token_urlsafe(64)
    hashed = hashlib.sha256(code_verifier.encode("ascii")).digest()
    code_challenge = base64.urlsafe_b64encode(hashed).decode("ascii").rstrip("=")
    return code_verifier, code_challenge

def get_authorization_url() -> Dict[str, str]:
    """Generates the X OAuth 2.0 User authorization URL."""
    if not settings.X_CLIENT_ID:
        raise ValueError("X_CLIENT_ID is not configured in .env")

    state = secrets.token_urlsafe(32)
    code_verifier, code_challenge = generate_pkce_pair()

    # Save state and code_verifier temporarily
    with open(STATE_FILE, "w") as f:
        json.dump({"state": state, "code_verifier": code_verifier, "created_at": time.time()}, f)

    scopes = [
        "dm.write",
        "dm.read",
        "tweet.read",
        "users.read",
        "offline.access"
    ]
    scope_str = " ".join(scopes)

    params = {
        "response_type": "code",
        "client_id": settings.X_CLIENT_ID,
        "redirect_uri": settings.X_REDIRECT_URI,
        "scope": scope_str,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256"
    }

    url = httpx.URL("https://twitter.com/i/oauth2/authorize", params=params)
    return {"auth_url": str(url), "state": state}

def exchange_code_for_token(code: str, state: str) -> Dict[str, Any]:
    """Exchanges authorization code for OAuth 2.0 access & refresh tokens."""
    if not os.path.exists(STATE_FILE):
        raise ValueError("OAuth session state not found. Please initiate login again.")

    with open(STATE_FILE, "r") as f:
        saved_data = json.load(f)

    code_verifier = saved_data.get("code_verifier")
    try:
        os.remove(STATE_FILE)
    except Exception:
        pass

    auth_header = base64.b64encode(f"{settings.X_CLIENT_ID}:{settings.X_CLIENT_SECRET}".encode()).decode()
    headers = {
        "Authorization": f"Basic {auth_header}",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.X_REDIRECT_URI,
        "code_verifier": code_verifier
    }

    with httpx.Client() as client:
        res = client.post("https://api.twitter.com/2/oauth2/token", data=data, headers=headers)
        if res.status_code != 200:
            raise ValueError(f"Failed to exchange X token: {res.text}")
        
        token_data = res.json()
        token_data["expires_at"] = time.time() + token_data.get("expires_in", 7200)

        # Get connected user info
        me_headers = {"Authorization": f"Bearer {token_data['access_token']}"}
        me_res = client.get("https://api.twitter.com/2/users/me", headers=me_headers)
        if me_res.status_code == 200:
            user_info = me_res.json().get("data", {})
            token_data["user"] = user_info

        with open(TOKEN_FILE, "w") as f:
            json.dump(token_data, f, indent=2)

        return token_data

def get_valid_access_token() -> str:
    """Returns a valid access token, auto-refreshing if expired."""
    if not os.path.exists(TOKEN_FILE):
        raise ValueError("X account is not connected. Please connect via /api/auth/x/login")

    with open(TOKEN_FILE, "r") as f:
        token_data = json.load(f)

    # Check if expired or about to expire in 60s
    if time.time() >= token_data.get("expires_at", 0) - 60:
        refresh_token = token_data.get("refresh_token")
        if not refresh_token:
            raise ValueError("X refresh token is missing. Please reconnect your X account.")

        auth_header = base64.b64encode(f"{settings.X_CLIENT_ID}:{settings.X_CLIENT_SECRET}".encode()).decode()
        headers = {
            "Authorization": f"Basic {auth_header}",
            "Content-Type": "application/x-www-form-urlencoded"
        }
        data = {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": settings.X_CLIENT_ID
        }

        with httpx.Client() as client:
            res = client.post("https://api.twitter.com/2/oauth2/token", data=data, headers=headers)
            if res.status_code != 200:
                raise ValueError(f"Failed to refresh X token: {res.text}")
            
            new_data = res.json()
            new_data["expires_at"] = time.time() + new_data.get("expires_in", 7200)
            if "user" in token_data:
                new_data["user"] = token_data["user"]
            
            with open(TOKEN_FILE, "w") as f:
                json.dump(new_data, f, indent=2)

            return new_data["access_token"]

    return token_data["access_token"]

def get_x_connection_status() -> Dict[str, Any]:
    """Returns the connection status and username of the authenticated X account."""
    if not os.path.exists(TOKEN_FILE):
        return {"connected": False, "username": None, "name": None}
    
    try:
        with open(TOKEN_FILE, "r") as f:
            data = json.load(f)
        user = data.get("user", {})
        return {
            "connected": True,
            "username": user.get("username"),
            "name": user.get("name"),
            "user_id": user.get("id")
        }
    except Exception:
        return {"connected": False, "username": None, "name": None}

def clean_x_handle(raw_handle: str) -> str:
    """Extracts username from handles like @user or https://x.com/user"""
    h = raw_handle.strip()
    h = h.replace("https://x.com/", "").replace("http://x.com/", "")
    h = h.replace("https://twitter.com/", "").replace("http://twitter.com/", "")
    h = h.lstrip("@").split("/")[0].split("?")[0].strip()
    return h

def resolve_x_user_id(username: str, token: str) -> str:
    """Resolves an X username into an X numeric user ID."""
    clean_user = clean_x_handle(username)
    headers = {"Authorization": f"Bearer {token}"}
    
    with httpx.Client() as client:
        res = client.get(f"https://api.twitter.com/2/users/by/username/{clean_user}", headers=headers)
        if res.status_code != 200:
            raise ValueError(f"Could not find X user @{clean_user}: {res.text}")
        data = res.json().get("data", {})
        user_id = data.get("id")
        if not user_id:
            raise ValueError(f"User @{clean_user} not found on X.")
        return user_id

def send_x_direct_message(session: Session, lead: Lead, message_text: str, custom_handle: Optional[str] = None) -> EmailMessage:
    """Sends a Direct Message to the lead on X (Twitter) and logs it in SQLite."""
    handle_to_use = custom_handle or lead.x_handle
    if not handle_to_use:
        raise ValueError("No X handle provided for this contact.")

    token = get_valid_access_token()
    clean_handle = clean_x_handle(handle_to_use)
    participant_id = resolve_x_user_id(clean_handle, token)

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    payload = {
        "participant_id": participant_id,
        "body": {
            "text": message_text
        }
    }

    # API v2 1-on-1 DM endpoint
    url = f"https://api.twitter.com/2/dm_conversations/with/{participant_id}/messages"
    dm_payload = {"text": message_text}

    with httpx.Client() as client:
        res = client.post(url, headers=headers, json=dm_payload)
        if res.status_code not in (200, 201):
            # Fallback format
            res = client.post(
                "https://api.twitter.com/2/dm_conversations/message",
                headers=headers,
                json={"participant_ids": [participant_id], "message": {"text": message_text}}
            )
            if res.status_code not in (200, 201):
                raise ValueError(f"Failed to send X Direct Message: {res.text}")

        res_data = res.json().get("data", {})
        dm_id = res_data.get("dm_event_id") or res_data.get("id") or f"x_dm_{int(time.time())}"

    # Update Lead in DB
    now = datetime.utcnow()
    lead.last_contacted_at = now
    if not lead.x_handle:
        lead.x_handle = f"@{clean_handle}"
    if lead.status == LeadStatus.NOT_CONTACTED.value:
        lead.status = LeadStatus.CONTACTED.value
    elif lead.status in [LeadStatus.CONTACTED.value, LeadStatus.FOLLOWED_UP.value]:
        lead.status = LeadStatus.FOLLOWED_UP.value
    lead.updated_at = now
    session.add(lead)

    # Log Message
    status_info = get_x_connection_status()
    sender_handle = f"@{status_info.get('username')}" if status_info.get("username") else "Praroop"

    msg_record = EmailMessage(
        lead_id=lead.id,
        channel=MessageChannel.X_DM.value,
        direction=EmailDirection.SENT.value,
        sender=sender_handle,
        recipient=f"@{clean_handle}",
        subject=f"X DM to @{clean_handle}",
        snippet=message_text[:200].strip(),
        body_text=message_text,
        sent_at=now,
        message_id=dm_id
    )
    session.add(msg_record)
    session.commit()
    session.refresh(msg_record)
    session.refresh(lead)

    return msg_record

def sync_x_dms_to_leads(session: Session, exclude_keywords: list[str] = ["anjan", "piyush"]) -> dict:
    """Syncs sent X Direct Messages into the Lead table, skipping excluded contacts."""
    token = get_valid_access_token()
    my_status = get_x_connection_status()
    my_user_id = my_status.get("user_id")

    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "dm_event.fields": "id,text,created_at,sender_id,dm_conversation_id",
        "expansions": "sender_id,participant_ids",
        "user.fields": "id,name,username,description",
        "max_results": 50
    }

    with httpx.Client() as client:
        res = client.get("https://api.twitter.com/2/dm_events", headers=headers, params=params)
        if res.status_code != 200:
            err_data = res.json() if "application/json" in res.headers.get("content-type", "") else {}
            detail = err_data.get("detail") or res.text
            raise ValueError(f"X API error ({res.status_code}): {detail}")
        
        data = res.json()
        events = data.get("data", [])
        users_list = data.get("includes", {}).get("users", [])
        user_map = {u["id"]: u for u in users_list}

        created = 0
        updated = 0
        skipped = 0

        for event in events:
            text = event.get("text", "")
            sender_id = event.get("sender_id")
            other_user_ids = [uid for uid in user_map.keys() if uid != my_user_id]
            for uid in other_user_ids:
                u_obj = user_map.get(uid)
                if not u_obj:
                    continue
                username = u_obj.get("username", "").lower()
                name = u_obj.get("name", "").lower()

                # Check exclusions (e.g. anjan, piyush)
                if any(ex.lower() in username or ex.lower() in name for ex in exclude_keywords):
                    skipped += 1
                    continue

                existing = session.exec(select(Lead).where(
                    (Lead.x_handle == f"@{u_obj.get('username')}") | 
                    (Lead.email == f"{u_obj.get('username')}@x.com")
                )).first()

                if not existing:
                    lead = Lead(
                        email=f"{u_obj.get('username')}@x.com",
                        first_name=u_obj.get("name", "").split(" ")[0] or u_obj.get("username"),
                        last_name=" ".join(u_obj.get("name", "").split(" ")[1:]) if " " in u_obj.get("name", "") else "",
                        x_handle=f"@{u_obj.get('username')}",
                        company="X / Twitter Prospect",
                        source="X Direct Message",
                        status=LeadStatus.CONTACTED.value,
                        notes=u_obj.get("description", "")
                    )
                    session.add(lead)
                    session.commit()
                    session.refresh(lead)
                    created += 1
                else:
                    lead = existing
                    updated += 1

                is_me_sender = (sender_id == my_user_id)
                msg_rec = EmailMessage(
                    lead_id=lead.id,
                    channel=MessageChannel.X_DM.value,
                    direction=EmailDirection.SENT.value if is_me_sender else EmailDirection.RECEIVED.value,
                    sender=f"@{my_status.get('username')}" if is_me_sender else f"@{u_obj.get('username')}",
                    recipient=f"@{u_obj.get('username')}" if is_me_sender else f"@{my_status.get('username')}",
                    subject=f"X DM with @{u_obj.get('username')}",
                    snippet=text[:200].strip(),
                    body_text=text,
                    message_id=event.get("id")
                )
                session.add(msg_rec)
                session.commit()

        return {"created": created, "updated": updated, "skipped": skipped, "total_events": len(events)}
