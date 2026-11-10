# Static site served by nginx. No build step: the repo files are the site.
FROM nginx:stable-alpine

# Replace the default server block with ours.
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx.conf /etc/nginx/conf.d/site.conf

COPY --chown=nginx:nginx . /usr/share/nginx/html
# nginx.conf has to be in the build context for the COPY above; don't publish it.
RUN rm /usr/share/nginx/html/nginx.conf

# Compress text files once, at the highest level, for gzip_static. The originals
# stay for clients that don't accept gzip. Same mtime keeps the ETag consistent.
RUN find /usr/share/nginx/html -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' \
      -o -name '*.txt' -o -name '*.xml' -o -name '*.csv' -o -name '*.svg' \) -size +1k \
    -exec sh -c 'for f; do gzip -9 -c "$f" > "$f.gz" && touch -r "$f" "$f.gz"; done' sh {} +

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
