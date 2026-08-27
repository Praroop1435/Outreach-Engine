from datetime import datetime
from enum import Enum
from typing import Optional, List
from sqlmodel import SQLModel, Field, Relationship
from pydantic import BaseModel, EmailStr

class LeadStatus(str, Enum):
    NOT_CONTACTED = "NOT_CONTACTED"
    CONTACTED = "CONTACTED"
    FOLLOWED_UP = "FOLLOWED_UP"
    REPLIED = "REPLIED"
    INTERESTED = "INTERESTED"
    NOT_INTERESTED = "NOT_INTERESTED"
    BOUNCED = "BOUNCED"
    ARCHIVED = "ARCHIVED"

class MessageChannel(str, Enum):
    EMAIL = "EMAIL"
    X_DM = "X_DM"

class EmailDirection(str, Enum):
    SENT = "SENT"
    RECEIVED = "RECEIVED"

# --- Database Models ---

class Lead(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True, unique=True)
    first_name: Optional[str] = Field(default=None, index=True)
    last_name: Optional[str] = None
    company: Optional[str] = Field(default=None, index=True)
    role: Optional[str] = None
    x_handle: Optional[str] = Field(default=None, index=True)
    website_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    status: str = Field(default=LeadStatus.NOT_CONTACTED.value, index=True)
    custom_hook: Optional[str] = None
    notes: Optional[str] = None
    source: str = Field(default="Manual")
    last_contacted_at: Optional[datetime] = None
    follow_up_due_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    messages: List["EmailMessage"] = Relationship(back_populates="lead", cascade_delete=True)

class EmailMessage(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    lead_id: Optional[int] = Field(default=None, foreign_key="lead.id", index=True)
    message_id: Optional[str] = Field(default=None, index=True)
    thread_id: Optional[str] = None
    channel: str = Field(default=MessageChannel.EMAIL.value, index=True)
    direction: str = Field(default=EmailDirection.SENT.value)
    sender: str
    recipient: str
    subject: str
    snippet: Optional[str] = None
    body_text: Optional[str] = None
    sent_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    lead: Optional[Lead] = Relationship(back_populates="messages")

class EmailTemplate(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    subject_template: str
    body_template: str
    category: str = Field(default="Cold Outreach")
    created_at: datetime = Field(default_factory=datetime.utcnow)

# --- Pydantic Request / Response Schemas ---

class LeadCreate(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    x_handle: Optional[str] = None
    website_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    status: Optional[str] = LeadStatus.NOT_CONTACTED.value
    custom_hook: Optional[str] = None
    notes: Optional[str] = None
    source: Optional[str] = "Manual"
    follow_up_due_at: Optional[datetime] = None

class LeadUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    role: Optional[str] = None
    x_handle: Optional[str] = None
    website_url: Optional[str] = None
    linkedin_url: Optional[str] = None
    status: Optional[str] = None
    custom_hook: Optional[str] = None
    notes: Optional[str] = None
    follow_up_due_at: Optional[datetime] = None

class LeadRead(BaseModel):
    id: int
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    company: Optional[str]
    role: Optional[str]
    x_handle: Optional[str] = None
    website_url: Optional[str]
    linkedin_url: Optional[str]
    status: str
    custom_hook: Optional[str]
    notes: Optional[str]
    source: str
    last_contacted_at: Optional[datetime]
    follow_up_due_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    message_count: Optional[int] = 0

class LeadDetail(LeadRead):
    messages: List[EmailMessage] = []

class SendEmailRequest(BaseModel):
    subject: str
    body: str
    template_id: Optional[int] = None
    attach_resume: bool = True

class SendXDMRequest(BaseModel):
    message: str
    x_handle: Optional[str] = None

class EmailPreviewRequest(BaseModel):
    lead_id: int
    subject_template: str
    body_template: str

class EmailTemplateCreate(BaseModel):
    name: str
    subject_template: str
    body_template: str
    category: Optional[str] = "Cold Outreach"

class EmailTemplateUpdate(BaseModel):
    name: Optional[str] = None
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    category: Optional[str] = None

class ImportLeadsRequest(BaseModel):
    csv_data: Optional[str] = None
    sheet_url: Optional[str] = None
    leads: Optional[List[LeadCreate]] = None
