-- ===========================================
-- DUBIZZLE MARKETPLACE - SQL SCHEMA
-- PostgreSQL Database
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- USER & AUTHENTICATION TABLES
-- ===========================================

-- Roles table
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role-Permission mapping
CREATE TABLE role_permissions (
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255),
    role_id INTEGER REFERENCES roles(id),
    is_verified BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    can_post_listings BOOLEAN DEFAULT TRUE,
    avatar_url TEXT,
    bio TEXT,
    last_login_at TIMESTAMP,
    last_listing_posted_at TIMESTAMP,
    last_chat_message_at TIMESTAMP,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role_id);
CREATE INDEX idx_users_blocked ON users(is_blocked);
CREATE INDEX idx_users_created ON users(created_at);

-- Refresh tokens
CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX idx_password_reset_hash ON password_reset_tokens(token_hash);

-- OTP requests
CREATE TABLE otp_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    phone VARCHAR(20) NOT NULL,
    otp_hash VARCHAR(255) NOT NULL,
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_otp_phone ON otp_requests(phone);
CREATE INDEX idx_otp_expires ON otp_requests(expires_at);

-- Device sessions
CREATE TABLE device_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    device_info JSONB,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_device_sessions_user ON device_sessions(user_id);
CREATE INDEX idx_device_sessions_ip ON device_sessions(ip_address);
CREATE INDEX idx_device_sessions_last_seen ON device_sessions(last_seen_at);

-- ===========================================
-- LISTING TABLES
-- ===========================================

-- Categories
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon_url TEXT,
    parent_id INTEGER REFERENCES categories(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_slug ON categories(slug);

-- Listing status enum
CREATE TYPE listing_status AS ENUM ('draft', 'pending', 'approved', 'rejected', 'sold', 'expired');

-- Listings
CREATE TABLE listings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AED',
    category_id INTEGER REFERENCES categories(id),
    city VARCHAR(100),
    country VARCHAR(100),
    address VARCHAR(200),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    status listing_status DEFAULT 'draft',
    reason_rejected TEXT,
    boosted_until TIMESTAMP,
    views_count INTEGER DEFAULT 0,
    favorites_count INTEGER DEFAULT 0,
    contact_phone VARCHAR(20),
    contact_email VARCHAR(255),
    is_negotiable BOOLEAN DEFAULT TRUE,
    condition VARCHAR(20),
    attributes JSONB,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    expires_at TIMESTAMP,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_listings_user ON listings(user_id);
CREATE INDEX idx_listings_category ON listings(category_id);
CREATE INDEX idx_listings_status ON listings(status);
CREATE INDEX idx_listings_status_created ON listings(status, created_at);
CREATE INDEX idx_listings_price ON listings(price);
CREATE INDEX idx_listings_city ON listings(city);
CREATE INDEX idx_listings_country ON listings(country);
CREATE INDEX idx_listings_boosted ON listings(boosted_until);
CREATE INDEX idx_listings_expires ON listings(expires_at);
CREATE INDEX idx_listings_created ON listings(created_at);

-- Full-text search index
CREATE INDEX idx_listings_fulltext ON listings USING gin(to_tsvector('english', title || ' ' || description));

-- Listing images
CREATE TABLE listing_images (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    s3_key TEXT,
    order_index INTEGER DEFAULT 0,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_listing_images_listing ON listing_images(listing_id);
CREATE INDEX idx_listing_images_order ON listing_images(order_index);

-- Listing categories (multi-category support)
CREATE TABLE listing_categories (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    UNIQUE(listing_id, category_id)
);

-- Favorites
CREATE TABLE favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, listing_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_listing ON favorites(listing_id);

-- Recently viewed
CREATE TABLE recently_viewed (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, listing_id)
);

CREATE INDEX idx_recently_viewed_user ON recently_viewed(user_id);
CREATE INDEX idx_recently_viewed_date ON recently_viewed(viewed_at);

-- Listing views
CREATE TABLE listing_views (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    device_info JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_listing_views_listing ON listing_views(listing_id);
CREATE INDEX idx_listing_views_user ON listing_views(user_id);
CREATE INDEX idx_listing_views_created ON listing_views(created_at);

-- Comment status enum
CREATE TYPE comment_status AS ENUM ('visible', 'hidden', 'deleted');

-- Listing comments
CREATE TABLE listing_comments (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_comment_id INTEGER REFERENCES listing_comments(id),
    content TEXT NOT NULL,
    status comment_status DEFAULT 'visible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_listing_comments_listing ON listing_comments(listing_id);
CREATE INDEX idx_listing_comments_user ON listing_comments(user_id);
CREATE INDEX idx_listing_comments_parent ON listing_comments(parent_comment_id);

-- Price alerts
CREATE TABLE price_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    price_threshold DECIMAL(12, 2) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    triggered_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, listing_id)
);

CREATE INDEX idx_price_alerts_user ON price_alerts(user_id);
CREATE INDEX idx_price_alerts_listing ON price_alerts(listing_id);

-- Short links
CREATE TABLE short_links (
    id SERIAL PRIMARY KEY,
    short_code VARCHAR(20) UNIQUE NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id INTEGER NOT NULL,
    clicks INTEGER DEFAULT 0,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_short_links_code ON short_links(short_code);

-- Import status enum
CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE import_row_status AS ENUM ('pending', 'success', 'failed');

-- Listing import batches
CREATE TABLE listing_import_batches (
    id SERIAL PRIMARY KEY,
    uploaded_by INTEGER REFERENCES users(id),
    file_name VARCHAR(255) NOT NULL,
    status import_status DEFAULT 'pending',
    total_rows INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX idx_import_batches_user ON listing_import_batches(uploaded_by);
CREATE INDEX idx_import_batches_status ON listing_import_batches(status);

-- Listing import rows
CREATE TABLE listing_import_rows (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER REFERENCES listing_import_batches(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    raw_data JSONB NOT NULL,
    listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
    status import_row_status DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_import_rows_batch ON listing_import_rows(batch_id);

-- ===========================================
-- CHAT TABLES
-- ===========================================

-- Chat rooms
CREATE TABLE chat_rooms (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    buyer_id INTEGER REFERENCES users(id),
    seller_id INTEGER REFERENCES users(id),
    is_blocked BOOLEAN DEFAULT FALSE,
    blocked_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(listing_id, buyer_id, seller_id)
);

CREATE INDEX idx_chat_rooms_buyer ON chat_rooms(buyer_id);
CREATE INDEX idx_chat_rooms_seller ON chat_rooms(seller_id);
CREATE INDEX idx_chat_rooms_listing ON chat_rooms(listing_id);

-- Chat messages
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id),
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    attachment TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX idx_chat_messages_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_messages_room_created ON chat_messages(room_id, created_at);
CREATE INDEX idx_chat_messages_read ON chat_messages(is_read);

-- ===========================================
-- REPORT & MODERATION TABLES
-- ===========================================

-- Report status enum
CREATE TYPE report_status AS ENUM ('pending', 'reviewed', 'dismissed', 'actioned');

-- Reported users
CREATE TABLE reported_users (
    id SERIAL PRIMARY KEY,
    reported_user_id INTEGER REFERENCES users(id),
    reporter_id INTEGER REFERENCES users(id),
    reason VARCHAR(200) NOT NULL,
    details TEXT,
    status report_status DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reported_users_reported ON reported_users(reported_user_id);
CREATE INDEX idx_reported_users_reporter ON reported_users(reporter_id);
CREATE INDEX idx_reported_users_status ON reported_users(status);

-- Reported listings
CREATE TABLE reported_listings (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
    reporter_id INTEGER REFERENCES users(id),
    reason VARCHAR(200) NOT NULL,
    details TEXT,
    status report_status DEFAULT 'pending',
    reviewed_by INTEGER,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reported_listings_listing ON reported_listings(listing_id);
CREATE INDEX idx_reported_listings_reporter ON reported_listings(reporter_id);
CREATE INDEX idx_reported_listings_status ON reported_listings(status);

-- Moderation status enum
CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected', 'needs_changes');

-- Moderation queue
CREATE TABLE moderation_queue (
    id SERIAL PRIMARY KEY,
    item_type VARCHAR(50) NOT NULL,
    item_id INTEGER NOT NULL,
    status moderation_status DEFAULT 'pending',
    assigned_to INTEGER REFERENCES users(id),
    moderator_comment TEXT,
    priority INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX idx_moderation_queue_status_created ON moderation_queue(status, created_at);
CREATE INDEX idx_moderation_queue_item ON moderation_queue(item_type, item_id);
CREATE INDEX idx_moderation_queue_assigned ON moderation_queue(assigned_to);

-- ===========================================
-- FRAUD & ANALYTICS TABLES
-- ===========================================

-- Fraud logs
CREATE TABLE fraud_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL,
    details JSONB NOT NULL,
    risk_score INTEGER NOT NULL,
    is_reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_logs_user ON fraud_logs(user_id);
CREATE INDEX idx_fraud_logs_type ON fraud_logs(type);
CREATE INDEX idx_fraud_logs_risk ON fraud_logs(risk_score);
CREATE INDEX idx_fraud_logs_created ON fraud_logs(created_at);

-- Search logs
CREATE TABLE search_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    query VARCHAR(200) NOT NULL,
    filters JSONB,
    results_count INTEGER DEFAULT 0,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_search_logs_query ON search_logs(query);
CREATE INDEX idx_search_logs_created ON search_logs(created_at);

-- API usage logs
CREATE TABLE api_usage_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_usage_endpoint ON api_usage_logs(endpoint);
CREATE INDEX idx_api_usage_user ON api_usage_logs(user_id);
CREATE INDEX idx_api_usage_status ON api_usage_logs(status_code);
CREATE INDEX idx_api_usage_created ON api_usage_logs(created_at);
CREATE INDEX idx_api_usage_endpoint_created ON api_usage_logs(endpoint, created_at);

-- Audit logs
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    actor_user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    metadata JSONB,
    ip_address VARCHAR(45) NOT NULL,
    device_info JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- ===========================================
-- SUPPORT TABLES
-- ===========================================

-- Ticket status enum
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Support tickets
CREATE TABLE support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    status ticket_status DEFAULT 'open',
    priority ticket_priority DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at);

-- Support ticket messages
CREATE TABLE support_ticket_messages (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    sender_type VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_support_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX idx_support_messages_sender ON support_ticket_messages(sender_id);

-- ===========================================
-- NOTIFICATION TABLES
-- ===========================================

-- Notification type enum
CREATE TYPE notification_type AS ENUM (
    'listing_approved',
    'listing_rejected',
    'listing_expired',
    'new_message',
    'price_alert',
    'new_favorite',
    'support_reply',
    'system'
);

-- Notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- ===========================================
-- WEBHOOK TABLES
-- ===========================================

-- Webhook status enum
CREATE TYPE webhook_status AS ENUM ('received', 'processing', 'processed', 'failed');

-- Webhook events
CREATE TABLE webhook_events (
    id SERIAL PRIMARY KEY,
    type VARCHAR(100) NOT NULL,
    external_id VARCHAR(255),
    payload JSONB NOT NULL,
    status webhook_status DEFAULT 'received',
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE INDEX idx_webhook_events_type ON webhook_events(type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_external ON webhook_events(external_id);

-- ===========================================
-- SYSTEM CONFIGURATION
-- ===========================================

-- System config
CREATE TABLE system_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- INITIAL DATA
-- ===========================================

-- Insert default roles
INSERT INTO roles (name, description) VALUES
    ('admin', 'Full system access'),
    ('moderator', 'Content moderation access'),
    ('seller', 'Can create and manage listings'),
    ('buyer', 'Can browse and purchase');

-- Insert default categories
INSERT INTO categories (name, slug, sort_order) VALUES
    ('Electronics', 'electronics', 1),
    ('Vehicles', 'vehicles', 2),
    ('Property', 'property', 3),
    ('Furniture', 'furniture', 4),
    ('Fashion', 'fashion', 5),
    ('Jobs', 'jobs', 6),
    ('Services', 'services', 7),
    ('Community', 'community', 8);

-- Insert system config
INSERT INTO system_config (key, value) VALUES
    ('maintenance_mode', 'false'),
    ('site_name', 'Marketplace'),
    ('support_email', 'support@marketplace.com');