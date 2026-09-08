source deploy/.env
DOMAIN=${DOMAIN:-proteus.local}
KC_URL_TRAEFIK="http://localhost:80"
HOST_HEADER="Host: auth.$DOMAIN"
KC_TOKEN=$(curl -s -X POST "$KC_URL_TRAEFIK/realms/master/protocol/openid-connect/token" -H "$HOST_HEADER" -d "client_id=admin-cli&grant_type=password&username=$KEYCLOAK_ADMIN_USER&password=$KEYCLOAK_ADMIN_PASSWORD" | jq -r '.access_token')
curl -s "$KC_URL_TRAEFIK/admin/realms/proteus" -H "$HOST_HEADER" -H "Authorization: Bearer $KC_TOKEN" | jq '.browserSecurityHeaders'
