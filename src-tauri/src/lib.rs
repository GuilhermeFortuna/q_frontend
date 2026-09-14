mod report;

use std::{borrow::Cow, env};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

fn init_native_sentry() -> Option<sentry::ClientInitGuard> {
    let dsn = env::var("SENTRY_DSN")
        .ok()
        .filter(|value| !value.trim().is_empty())?;
    let Ok(dsn) = dsn.parse::<sentry::types::Dsn>() else {
        eprintln!("Sentry native initialization skipped: invalid SENTRY_DSN");
        return None;
    };
    let environment = env::var("SENTRY_ENVIRONMENT").unwrap_or_else(|_| "local".to_string());
    let release = env::var("Q_RELEASE")
        .or_else(|_| env::var("VITE_SENTRY_RELEASE"))
        .ok()
        .filter(|value| !value.trim().is_empty())
        .map(Cow::Owned);

    Some(sentry::init((
        dsn,
        sentry::ClientOptions {
            environment: Some(Cow::Owned(environment)),
            release,
            send_default_pii: false,
            ..Default::default()
        },
    )))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _sentry_guard = init_native_sentry();
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![report::generate_backtest_report])
        .setup(|app| {
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let mut tray_builder = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                });

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            let _tray = tray_builder.build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        });

    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_, _| {});
}
