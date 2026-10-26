try {
    const articles = Array.from(document.querySelectorAll("article[data-testid='tweet']"));
    const results = [];

    articles.forEach(art => {
        try {
            // User Name and Handle
            const userDiv = art.querySelector("div[data-testid='User-Name']");
            let name = "";
            let handle = "";
            if (userDiv) {
                const links = Array.from(userDiv.querySelectorAll("a"));
                if (links.length > 0) name = links[0].innerText.split("\n")[0];
                const handleLink = links.find(l => l.innerText.startsWith("@"));
                if (handleLink) handle = handleLink.innerText.split("\n")[0];
            }

            // Tweet Text
            const textDiv = art.querySelector("div[data-testid='tweetText']");
            const text = textDiv ? textDiv.innerText : "";

            // Tweet Status Link
            const timeEl = art.querySelector("time");
            let tweetUrl = "";
            if (timeEl && timeEl.parentElement && timeEl.parentElement.tagName === "A") {
                tweetUrl = timeEl.parentElement.href;
            }

            // External Links
            const extLinks = Array.from(art.querySelectorAll("a[href*='t.co']")).map(a => a.href);

            // Check if DM button is visible or if user profile can be messaged
            const dmIcon = art.querySelector("button[data-testid='dm'], div[data-testid='dm']");
            const canDm = !!dmIcon;

            if (text.length > 0) {
                results.push({
                    name: name,
                    handle: handle,
                    text: text,
                    tweetUrl: tweetUrl,
                    links: extLinks,
                    canDm: canDm
                });
            }
        } catch (innerErr) {
            // Ignore single card error
        }
    });

    window.name = JSON.stringify(results);
} catch (e) {
    window.name = JSON.stringify({ error: e.message });
}
