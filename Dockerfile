# Use the official nginx image as base
FROM nginx:alpine

# Copy the dist folder contents to nginx's default serving directory
COPY dist/ /usr/share/nginx/html/

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 