// The desktop app is a window around the web app in web/dist. It has no extra native features:
// everything (sign-in, data, files) goes through the server, exactly like the browser version.
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("Factory Atlas could not start");
}
