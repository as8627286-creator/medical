# Headers that every proxied request receives.
#
# X-Forwarded-* lets the application work out the client address and the
# public scheme. The application also verifies the Origin header on state
# changing API requests.

proxy_http_version 1.1;
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_set_header X-Request-Id $request_id;

proxy_connect_timeout 10s;
proxy_send_timeout 60s;
proxy_read_timeout 60s;

proxy_buffering off;
