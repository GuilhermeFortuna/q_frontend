/// Limit the rendering workaround to the runtime reproduced in native testing.
pub(crate) fn needs_filter_compatibility(version: &str) -> bool {
    version == "2.54.1"
}

pub(crate) fn initialization_script(version: &str) -> Option<&'static str> {
    needs_filter_compatibility(version).then_some(include_str!("webkit_filter_compat.js"))
}

#[cfg(test)]
mod tests {
    use super::needs_filter_compatibility;

    #[test]
    fn enables_compatibility_for_the_confirmed_webkit_regression() {
        assert!(needs_filter_compatibility("2.54.1"));
    }

    #[test]
    fn preserves_other_runtime_versions() {
        for version in ["2.52.6", "2.54.0", "2.54.2", "2.56.0", "", "unknown"] {
            assert!(!needs_filter_compatibility(version), "{version}");
        }
    }
}
