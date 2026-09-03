use std::fs;
use std::path::Path;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::Emitter;

#[cfg(target_os = "macos")]
use std::ffi::CString;
#[cfg(target_os = "macos")]
use std::os::unix::ffi::OsStrExt;

#[tauri::command]
fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let mut command = std::process::Command::new("open");

    #[cfg(target_os = "windows")]
    let mut command = std::process::Command::new("explorer");

    #[cfg(target_os = "linux")]
    let mut command = std::process::Command::new("xdg-open");

    let status = command.arg(path).status().map_err(|error| error.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("open path command failed: {status}"))
    }
}

#[tauri::command]
fn write_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let path = Path::new(&path);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    fs::write(path, bytes).map_err(|error| error.to_string())
}

#[tauri::command]
fn is_app_on_read_only_volume() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    {
        let executable = std::env::current_exe().map_err(|error| error.to_string())?;
        let path = CString::new(executable.as_os_str().as_bytes()).map_err(|error| error.to_string())?;
        let mut file_system = std::mem::MaybeUninit::<libc::statfs>::uninit();
        let result = unsafe { libc::statfs(path.as_ptr(), file_system.as_mut_ptr()) };
        if result != 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }

        let file_system = unsafe { file_system.assume_init() };
        return Ok((file_system.f_flags & libc::MNT_RDONLY as u32) != 0);
    }

    #[cfg(not(target_os = "macos"))]
    Ok(false)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            open_path,
            write_binary_file,
            is_app_on_read_only_volume
        ])
        .on_menu_event(|app, event| {
            if event.id().as_ref() == "settings" {
                let _ = app.emit("open-settings", ());
            }
        })
        .setup(|app| {
            let settings = MenuItem::with_id(app, "settings", "设置...", true, Some("CmdOrCtrl+,"))?;
            let app_menu = Submenu::with_items(
                app,
                "图片切图工具",
                true,
                &[
                    &settings,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::quit(app, Some("退出"))?,
                ],
            )?;
            let open_image = MenuItem::with_id(app, "open_image", "打开图片...", true, None::<&str>)?;
            let save_project = MenuItem::with_id(app, "save_project", "保存项目...", true, None::<&str>)?;
            let export = MenuItem::with_id(app, "export", "导出切片...", true, None::<&str>)?;
            let file_menu = Submenu::with_items(
                app,
                "文件",
                true,
                &[
                    &open_image,
                    &save_project,
                    &PredefinedMenuItem::separator(app)?,
                    &export,
                ],
            )?;
            let edit_menu = Submenu::with_items(
                app,
                "编辑",
                true,
                &[
                    &PredefinedMenuItem::undo(app, Some("撤销"))?,
                    &PredefinedMenuItem::redo(app, Some("重做"))?,
                    &PredefinedMenuItem::separator(app)?,
                    &PredefinedMenuItem::cut(app, Some("剪切"))?,
                    &PredefinedMenuItem::copy(app, Some("复制"))?,
                    &PredefinedMenuItem::paste(app, Some("粘贴"))?,
                    &PredefinedMenuItem::select_all(app, Some("全选"))?,
                ],
            )?;
            let view_menu = Submenu::with_items(
                app,
                "视图",
                true,
                &[&PredefinedMenuItem::fullscreen(app, Some("进入全屏"))?],
            )?;
            let window_menu = Submenu::with_items(
                app,
                "窗口",
                true,
                &[
                    &PredefinedMenuItem::minimize(app, Some("最小化"))?,
                    &PredefinedMenuItem::close_window(app, Some("关闭窗口"))?,
                ],
            )?;
            let menu = Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])?;
            app.set_menu(menu)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running 图片切图工具");
}
