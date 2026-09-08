source deploy/.env
MM_URL="http://localhost:80"
MM_HOST_HEADER="Host: chat.proteus.local"
MM_LOGIN_PAYLOAD="{\"login_id\":\"sysadmin\",\"password\":\"$MATTERMOST_ADMIN_PASSWORD\"}"
MM_TOKEN=$(curl -s -i -X POST "$MM_URL/api/v4/users/login" -H "$MM_HOST_HEADER" -H "Content-Type: application/json" -d "$MM_LOGIN_PAYLOAD" | grep Token | awk '{print $2}' | tr -d '\r')
curl -s -X GET "$MM_URL/api/v4/config" -H "$MM_HOST_HEADER" -H "Authorization: Bearer $MM_TOKEN" | jq '.ServiceSettings.SiteURL, .GitLabSettings'
