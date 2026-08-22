fn main() {
    // A tiny generated development icon keeps a fresh source checkout buildable;
    // release branding can replace this file without changing native code.
    let icon = std::path::Path::new("icons/icon.png");
    if !icon.exists() {
        std::fs::create_dir_all(icon.parent().unwrap()).expect("create icon directory");
        const PNG: &[u8] = b"\x89PNG\r\n\x1a\n\0\0\0\rIHDR\0\0\0\x01\0\0\0\x01\x08\x06\0\0\0\x1f\x15\xc4\x89\0\0\0\rIDAT\x08\xd7c\xf8\xcf\xc0\xf0\x1f\0\x05\0\x01\xff\x89\x99=\x1d\0\0\0\0IEND\xaeB`\x82";
        std::fs::write(icon, PNG).expect("write development icon");
    }
    tauri_build::build()
}
