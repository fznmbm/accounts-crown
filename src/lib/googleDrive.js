const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const SCOPES =
  "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly";

let tokenClient = null;
let accessToken = null;
let pickerLoaded = false;
let gisLoaded = false;

function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      res();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

export async function initGoogleDrive() {
  await Promise.all([
    loadScript("https://apis.google.com/js/api.js"),
    loadScript("https://accounts.google.com/gsi/client"),
  ]);

  await new Promise((res) => window.gapi.load("picker", res));
  pickerLoaded = true;

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: () => {},
  });
  gisLoaded = true;
}

function getToken() {
  return new Promise((res, rej) => {
    tokenClient.callback = (resp) => {
      if (resp.error) {
        rej(resp.error);
        return;
      }
      accessToken = resp.access_token;
      res(accessToken);
    };
    if (accessToken) {
      res(accessToken);
      return;
    }
    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export async function openDrivePicker({ onPicked, mimeTypes }) {
  if (!pickerLoaded || !gisLoaded) await initGoogleDrive();
  const token = await getToken();

  const view = new window.google.picker.DocsView()
    .setIncludeFolders(false)
    .setSelectFolderEnabled(false);

  if (mimeTypes) view.setMimeTypes(mimeTypes);

  new window.google.picker.PickerBuilder()
    .addView(view)
    .addView(new window.google.picker.DocsUploadView())
    .setOAuthToken(token)
    .setDeveloperKey(API_KEY)
    .setCallback((data) => {
      if (data.action === window.google.picker.Action.PICKED) {
        const file = data.docs[0];
        onPicked({
          id: file.id,
          name: file.name,
          url: file.url,
          mimeType: file.mimeType,
          iconUrl: file.iconUrl,
        });
      }
    })
    .build()
    .setVisible(true);
}
