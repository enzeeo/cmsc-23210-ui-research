# Google Sheets Tracking Setup

This setup uses one Google Apps Script endpoint for multiple repos. Each repo sends its own `condition` value. The Apps Script does not hardcode the condition.

## What You Need From Me

To wire this repo completely, send me:

1. The deployed Apps Script web app URL ending in `/exec`.
2. The condition name for this repo, for example `visual`.
3. The condition name for the other repo, for example `text`.
4. The final link that should appear on `link.html`, if it is not already correct.

Do not send your Google password or private account credentials.

## Exact Steps

1. Open <https://drive.google.com>.
2. Click `New`.
3. Click `Google Sheets`.
4. Rename the spreadsheet to something clear, for example `Terms Consent Tracking`.
5. In the bottom-left sheet tab, rename the first tab to `Responses`.
6. In row 1, add these headers exactly:
   - `Recorded At`
   - `Typed Name`
   - `Selected Action`
   - `Condition`
   - `Pressed At ISO Timestamp`
   - `Time From Page Open To Selection Milliseconds`
7. In the Google Sheet, click `Extensions`.
8. Click `Apps Script`.
9. Delete any starter code in `Code.gs`.
10. Copy all code from `docs/google-apps-script/Code.gs`.
11. Paste it into the Apps Script editor.
12. Click the save icon.
13. Name the Apps Script project, for example `Terms Consent Tracking Endpoint`.
14. Click `Deploy`.
15. Click `New deployment`.
16. Next to `Select type`, click the gear icon.
17. Select `Web app`.
18. In `Description`, enter `Initial tracking endpoint`.
19. Set `Execute as` to `Me`.
20. Set `Who has access` to `Anyone`.
21. Click `Deploy`.
22. Google will ask for authorization. Click `Authorize access`.
23. Choose your Google account.
24. If Google shows an unverified app warning, click `Advanced`.
25. Click `Go to Terms Consent Tracking Endpoint`.
26. Click `Allow`.
27. Copy the `Web app URL`. It must end in `/exec`.
28. Send me that `/exec` URL, or paste it into `script.js` yourself.
29. In `script.js`, set `TRACKING_ENDPOINT_URL` to the copied `/exec` URL.
30. In `script.js`, set `TRACKING_CONDITION` to this repo's condition.
31. In the other repo, use the same `TRACKING_ENDPOINT_URL`, but set a different `TRACKING_CONDITION`.
32. Commit and push both repos to GitHub Pages.
33. Open the live GitHub Pages site for repo 1.
34. Scroll to the bottom of the terms.
35. Type a test name.
36. Click `Accept`.
37. Open the Google Sheet.
38. Confirm a new row appears with the typed name, `Accept`, and repo 1's condition.
39. Open the live GitHub Pages site for repo 2.
40. Repeat the test with `Reject`.
41. Confirm a new row appears with `Reject` and repo 2's condition.

## Current Repo Values

Current file: `script.js`

```js
const TRACKING_ENDPOINT_URL = "https://script.google.com/macros/s/AKfycbwwkyc8N0N--qod2lZNL7epFmSaII0MzEH6_hLaOMkVej-sh-moeAUNyUFiIgBwcN84cw/exec";
const TRACKING_CONDITION = "visual";
```

Change only those values when switching endpoint or condition.

## Important Notes

- The Apps Script receives `condition` from the website request.
- The same Apps Script can receive rows from both repos.
- The typed name is stored exactly as the browser sends it.
- `Accept` and `Reject` are both accepted values.
- The endpoint is public because GitHub Pages is a static public site.
- A public endpoint can receive spam if someone finds the URL.

## Sources

- Google Apps Script web apps: <https://developers.google.com/apps-script/guides/web>
- Google Apps Script ContentService: <https://developers.google.com/apps-script/reference/content/content-service>
