import re

with open("docs/api-swagger.yaml", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update PluginInfo
plugin_info_addition = """        is_official:
          type: boolean
        download_count:
          type: integer
        category:
          type: string
          example: "HR"
        tags:
          type: array
          items:
            type: string
        credentials_schema:
          type: array
          items:
            $ref: '#/components/schemas/CredentialFieldSchemaOut'"""
content = re.sub(
    r"        is_official:\n          type: boolean\n        download_count:\n          type: integer",
    plugin_info_addition,
    content,
    count=1
)

# 2. Add PluginDetailResponse, CredentialFieldSchemaOut, CredentialInputSchema, InstallStepLog, InstallStatusResponse, PluginCredentialPayload
schemas_addition = """    PluginDetailResponse:
      allOf:
        - $ref: '#/components/schemas/PluginInfo'
        - type: object
          properties:
            screenshots:
              type: array
              items:
                type: string
            long_description:
              type: string
            license:
              type: string

    CredentialFieldSchemaOut:
      type: object
      properties:
        key:
          type: string
        label:
          type: string
        type:
          type: string
        required:
          type: boolean
        placeholder:
          type: string
        description:
          type: string
        default:
          type: string
        options:
          type: array
          items:
            type: string
        credential_type_name:
          type: string

    CredentialInputSchema:
      type: object
      properties:
        key:
          type: string
        value:
          type: string
        credential_type_name:
          type: string
      required:
        - key
        - value

    PluginCredentialPayload:
      type: object
      properties:
        credentials:
          type: array
          items:
            $ref: '#/components/schemas/CredentialInputSchema'

    InstallStepLog:
      type: object
      properties:
        step:
          type: string
        status:
          type: string
        at:
          type: string
        message:
          type: string

    InstallStatusResponse:
      type: object
      properties:
        overall_status:
          type: string
        steps:
          type: array
          items:
            $ref: '#/components/schemas/InstallStepLog'
        plugin_id:
          type: string

    PluginInfo:"""
content = content.replace("    PluginInfo:", schemas_addition, 1)

# 3. Update PluginInstallRequest
install_req_addition = """    PluginInstallRequest:
      type: object
      required:
        - code_name
        - manifest_url
      properties:
        code_name:
          type: string
          example: "hr-module"
          description: "Định danh duy nhất của Plugin trên Marketplace"
        manifest_url:
          type: string
          format: uri
          example: "https://raw.githubusercontent.com/CuongKenn/ICTU_Proteus-os/main/plugins/hr-module/manifest.yaml"
          description: "URL dẫn tới file manifest.yaml của Plugin"
        config_override:
          type: object
          nullable: true
          description: "Cấu hình tùy chỉnh (ghi đè default trong manifest)"
        credentials:
          type: array
          items:
            $ref: '#/components/schemas/CredentialInputSchema'"""
content = re.sub(
    r"    PluginInstallRequest:.*?config_override:.*?description: \"Cấu hình tùy chỉnh \(ghi đè default trong manifest\)\"",
    install_req_addition,
    content,
    flags=re.DOTALL
)

# 4. Add Paths
paths_addition = """  /plugins/{plugin_id}:
    get:
      summary: Chi tiết Plugin
      tags: [Plugin Marketplace]
      parameters:
        - name: plugin_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Chi tiết
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/StandardResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/PluginDetailResponse'

  /plugins/{plugin_id}/credentials:
    post:
      summary: Cấu hình credentials cho plugin
      tags: [Plugin Marketplace]
      parameters:
        - name: plugin_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PluginCredentialPayload'
      responses:
        '200':
          description: Lưu thành công
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/StandardResponse'

  /plugins/install/{task_id}/status:
    get:
      summary: Theo dõi trạng thái cài đặt plugin
      tags: [Plugin Marketplace]
      parameters:
        - name: task_id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Trạng thái cài đặt
          content:
            application/json:
              schema:
                allOf:
                  - $ref: '#/components/schemas/StandardResponse'
                  - type: object
                    properties:
                      data:
                        $ref: '#/components/schemas/InstallStatusResponse'

  /plugins/install:"""

content = content.replace("  /plugins/install:", paths_addition, 1)

with open("docs/api-swagger.yaml", "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
