/// Remove terminal SGR styling from previews, without changing original log files.
pub fn plain_text(text: &str) -> String {
    let bytes = text.as_bytes();
    let mut result = String::with_capacity(text.len());
    let mut start = 0;
    let mut cursor = 0;
    while cursor + 1 < bytes.len() {
        if bytes[cursor] == 0x1b && bytes[cursor + 1] == b'[' {
            let mut end = cursor + 2;
            while end < bytes.len()
                && (bytes[end].is_ascii_digit() || matches!(bytes[end], b';' | b':'))
            {
                end += 1;
            }
            if bytes.get(end) == Some(&b'm') {
                result.push_str(&text[start..cursor]);
                cursor = end + 1;
                start = cursor;
                continue;
            }
        }
        cursor += 1;
    }
    result.push_str(&text[start..]);
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn removes_style_codes_without_damaging_chinese_or_layout() {
        let text = "\x1b[36mINFO\x1b[0m[01:16:46] 初始化成功\t\x1b[36mmodule\x1b[0m=MFW\r\n";
        assert_eq!(
            plain_text(text),
            "INFO[01:16:46] 初始化成功\tmodule=MFW\r\n"
        );
        assert_eq!(plain_text("\x1b[1;31m错误\x1b[m"), "错误");
        assert_eq!(plain_text("\x1b[38;2;255;120;0m中文 🌤\x1b[0m"), "中文 🌤");
    }

    #[test]
    fn preserves_plain_text_and_unrelated_bracket_content() {
        let text = "路径 C:\\项目\\日志 [36m 正常 ? \n下一行";
        assert_eq!(plain_text(text), text);
        assert_eq!(plain_text(""), "");
    }
}
