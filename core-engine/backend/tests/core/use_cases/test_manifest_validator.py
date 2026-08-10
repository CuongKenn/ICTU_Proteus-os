import pytest
from app.core.use_cases.manifest_validator import (
    ManifestValidator,
    DSLInvalidParametersError,
)

def test_manifest_validator_valid():
    yaml_content = """
    manifest_version: 1.1.0
    name: plugin-demo
    display_name: Demo Plugin
    version: 1.0.0
    description: Demo plugin
    author: Team
    license: MIT
    metadata:
        tags: [demo]
    """
    validator = ManifestValidator()
    entity = validator.validate_yaml_string(yaml_content)
    
    assert entity.name == "plugin-demo"
    assert entity.version == "1.0.0"

def test_manifest_validator_invalid_name():
    yaml_content = """
    manifest_version: 1.1.0
    name: PluginDemo_123
    display_name: Demo Plugin
    version: 1.0.0
    description: Demo
    author: Team
    license: MIT
    metadata:
        tags: []
    """
    validator = ManifestValidator()
    with pytest.raises(DSLInvalidParametersError) as exc_info:
        validator.validate_yaml_string(yaml_content)
    
    assert "kebab-case" in str(exc_info.value)

def test_manifest_validator_missing_required_fields():
    yaml_content = """
    manifest_version: 1.1.0
    name: plugin-demo
    """
    validator = ManifestValidator()
    with pytest.raises(DSLInvalidParametersError) as exc_info:
        validator.validate_yaml_string(yaml_content)
    
    assert "Thiếu trường bắt buộc" in str(exc_info.value)
def test_manifest_validator_invalid_yaml():
    yaml_content = """
    manifest_version: 1.1.0
    name: plugin-demo
    invalid: [ yaml: %^&*
    """
    validator = ManifestValidator()
    with pytest.raises(DSLInvalidParametersError) as exc_info:
        validator.validate_yaml_string(yaml_content)
    assert "parse error" in str(exc_info.value).lower()

def test_manifest_validator_invalid_version():
    yaml_content = """
    manifest_version: 1.1.0
    name: plugin-demo
    display_name: Demo Plugin
    version: v1.0.0
    description: Demo
    author: Team
    license: MIT
    """
    validator = ManifestValidator()
    with pytest.raises(DSLInvalidParametersError) as exc_info:
        validator.validate_yaml_string(yaml_content)
    assert "version" in str(exc_info.value).lower()

def test_manifest_validator_invalid_ui_apps():
    yaml_content = """
    manifest_version: 1.1.0
    name: plugin-demo
    display_name: Demo
    version: 1.0.0
    description: Demo
    author: Team
    license: MIT
    ui_apps:
      - name: Demo
        path: /api/demo
        src: http://demo
    """
    validator = ManifestValidator()
    with pytest.raises(DSLInvalidParametersError) as exc_info:
        validator.validate_yaml_string(yaml_content)
    assert "path" in str(exc_info.value)

def test_manifest_validator_invalid_ui_apps_type():
    yaml_content = """
    manifest_version: 1.1.0
    name: plugin-demo
    display_name: Demo
    version: 1.0.0
    description: Demo
    author: Team
    license: MIT
    ui_apps:
      - invalid_string
    """
    validator = ManifestValidator()
    with pytest.raises(DSLInvalidParametersError) as exc_info:
        validator.validate_yaml_string(yaml_content)
    assert "phải là một object (dictionary)" in str(exc_info.value)
