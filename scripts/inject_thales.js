
window.name = (function() {
    const logs = [];

    function setVal(id, v) {
        const el = document.getElementById(id);
        if (!el) {
            logs.push("MISSING: " + id);
            return false;
        }
        el.focus();
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        logs.push("SET: " + id + " = " + el.value);
        return true;
    }

    function setSelect(id, targetVal) {
        const el = document.getElementById(id);
        if (!el) {
            logs.push("MISSING SELECT: " + id);
            return false;
        }
        el.focus();
        let matched = false;
        for (let i = 0; i < el.options.length; i++) {
            if (el.options[i].value === targetVal || el.options[i].text.toLowerCase().includes(targetVal.toLowerCase())) {
                el.selectedIndex = i;
                el.options[i].selected = true;
                el.value = el.options[i].value;
                matched = true;
                break;
            }
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        logs.push("SELECT: " + id + " = " + el.value);
        return matched;
    }

    function setCheck(id, checked) {
        const el = document.getElementById(id);
        if (!el) {
            logs.push("MISSING CHECK: " + id);
            return false;
        }
        el.focus();
        if (el.checked !== checked) {
            el.click();
        }
        el.checked = checked;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        logs.push("CHECK: " + id + " = " + el.checked);
        return true;
    }

    // 1. Source
    setSelect("sourceType", "Social Media");

    // 2. Personal Names
    setVal("cntryFields.firstName", "Praroop");
    setVal("cntryFields.lastName", "Anand");
    setVal("cntryFields.localFirstName", "Praroop");
    setVal("cntryFields.localPrimary", "Anand");
    setSelect("cntryFields.preferredName", "No");

    // 3. Address
    setVal("cntryFields.addressLine1", "Koramangala");
    setVal("cntryFields.city", "Bengaluru");
    setVal("cntryFields.postalCode", "560034");

    // 4. Contact
    setVal("email", "anandpraroop@gmail.com");
    setSelect("deviceType", "Mobile");
    setSelect("phoneWidget.countryPhoneCode", "IND_91");
    setVal("phoneWidget.phoneNumber", "8210118421");

    // 5. Consents
    setCheck("fitScoreYes", true);
    setCheck("shareProfile", true);
    setCheck("emailCommunication", true);

    return JSON.stringify({
        status: "SUCCESS",
        logs: logs,
        snapshot: {
            sourceType: document.getElementById("sourceType")?.value,
            firstName: document.getElementById("cntryFields.firstName")?.value,
            lastName: document.getElementById("cntryFields.lastName")?.value,
            localFirstName: document.getElementById("cntryFields.localFirstName")?.value,
            localPrimary: document.getElementById("cntryFields.localPrimary")?.value,
            preferredName: document.getElementById("cntryFields.preferredName")?.value,
            addressLine1: document.getElementById("cntryFields.addressLine1")?.value,
            city: document.getElementById("cntryFields.city")?.value,
            postalCode: document.getElementById("cntryFields.postalCode")?.value,
            email: document.getElementById("email")?.value,
            deviceType: document.getElementById("deviceType")?.value,
            countryPhoneCode: document.getElementById("phoneWidget.countryPhoneCode")?.value,
            phoneNumber: document.getElementById("phoneWidget.phoneNumber")?.value,
            fitScoreYes: document.getElementById("fitScoreYes")?.checked,
            shareProfile: document.getElementById("shareProfile")?.checked,
            emailCommunication: document.getElementById("emailCommunication")?.checked
        }
    });
})();
