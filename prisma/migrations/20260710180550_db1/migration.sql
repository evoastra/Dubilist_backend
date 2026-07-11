-- CreateTable
CREATE TABLE `roles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(50) NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(20) NULL,
    `password_hash` VARCHAR(255) NULL,
    `role_id` INTEGER NOT NULL,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `is_blocked` BOOLEAN NOT NULL DEFAULT false,
    `avatar_url` VARCHAR(500) NULL,
    `bio` TEXT NULL,
    `last_login_at` DATETIME(3) NULL,
    `last_listing_posted_at` DATETIME(3) NULL,
    `last_chat_message_at` DATETIME(3) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `avatar_s3_key` VARCHAR(500) NULL,
    `can_post_listings` BOOLEAN NOT NULL DEFAULT true,
    `reset_password_expires` DATETIME(3) NULL,
    `reset_password_token` VARCHAR(255) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_phone_idx`(`phone`),
    INDEX `users_role_id_idx`(`role_id`),
    INDEX `users_is_blocked_idx`(`is_blocked`),
    INDEX `users_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_applications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `job_listing_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `dob` DATETIME(3) NULL,
    `email` VARCHAR(255) NOT NULL,
    `mobile_no` VARCHAR(20) NOT NULL,
    `languages` JSON NULL,
    `nationality` VARCHAR(100) NULL,
    `location` VARCHAR(200) NULL,
    `visa_status` VARCHAR(100) NULL,
    `resume_url` VARCHAR(500) NOT NULL,
    `resume_s3_key` VARCHAR(500) NULL,
    `qualification` VARCHAR(255) NULL,
    `job_status` VARCHAR(50) NOT NULL,
    `years_of_experience` INTEGER NULL,
    `salary_expectation` DOUBLE NULL,
    `salary_currency` VARCHAR(10) NOT NULL DEFAULT 'AED',
    `cover_letter` TEXT NULL,
    `portfolio_url` VARCHAR(500) NULL,
    `linkedin_url` VARCHAR(500) NULL,
    `status` ENUM('pending', 'reviewing', 'shortlisted', 'rejected', 'accepted') NOT NULL DEFAULT 'pending',
    `employer_notes` TEXT NULL,
    `reviewed_at` DATETIME(3) NULL,
    `reviewed_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `job_applications_job_listing_id_idx`(`job_listing_id`),
    INDEX `job_applications_user_id_idx`(`user_id`),
    INDEX `job_applications_status_idx`(`status`),
    INDEX `job_applications_created_at_idx`(`created_at`),
    INDEX `job_applications_reviewed_by_fkey`(`reviewed_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    INDEX `refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `icon_url` VARCHAR(500) NULL,
    `parent_id` INTEGER NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `image_url` VARCHAR(500) NULL,
    `thumbnails` JSON NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `s3_key` VARCHAR(500) NULL,

    UNIQUE INDEX `categories_slug_key`(`slug`),
    INDEX `categories_parent_id_idx`(`parent_id`),
    INDEX `categories_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `listings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NOT NULL,
    `price` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'AED',
    `category_id` INTEGER NOT NULL,
    `city` VARCHAR(100) NULL,
    `country` VARCHAR(100) NULL,
    `address` VARCHAR(500) NULL,
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `status` ENUM('draft', 'pending', 'approved', 'rejected', 'sold', 'expired', 'completed') NOT NULL DEFAULT 'draft',
    `reason_rejected` TEXT NULL,
    `views_count` INTEGER NOT NULL DEFAULT 0,
    `favorites_count` INTEGER NOT NULL DEFAULT 0,
    `contact_phone` VARCHAR(20) NULL,
    `contact_email` VARCHAR(255) NULL,
    `is_negotiable` BOOLEAN NOT NULL DEFAULT true,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `contact_whatsapp` VARCHAR(20) NULL,
    `featured_until` DATETIME(3) NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,

    INDEX `listings_user_id_idx`(`user_id`),
    INDEX `listings_category_id_idx`(`category_id`),
    INDEX `listings_status_idx`(`status`),
    INDEX `listings_status_created_at_idx`(`status`, `created_at`),
    INDEX `listings_price_idx`(`price`),
    INDEX `listings_city_idx`(`city`),
    INDEX `listings_is_featured_idx`(`is_featured`),
    INDEX `listings_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `listing_images` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listing_id` INTEGER NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `thumbnail_url` VARCHAR(500) NULL,
    `s3_key` VARCHAR(500) NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `listing_images_listing_id_idx`(`listing_id`),
    INDEX `listing_images_order_index_idx`(`order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `motor_listings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listing_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `make` VARCHAR(100) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `variant` VARCHAR(100) NULL,
    `year` INTEGER NOT NULL,
    `kilometres` INTEGER NULL,
    `hours_used` INTEGER NULL,
    `transmission` VARCHAR(50) NULL,
    `fuel_type` VARCHAR(50) NULL,
    `body_type` VARCHAR(50) NULL,
    `motor_type` VARCHAR(50) NULL,
    `engine_size` INTEGER NULL,
    `cylinders` INTEGER NULL,
    `horsepower` INTEGER NULL,
    `payload_capacity` INTEGER NULL,
    `seating_capacity` INTEGER NULL,
    `condition` VARCHAR(50) NULL,
    `color` VARCHAR(50) NULL,
    `interior_color` VARCHAR(50) NULL,
    `warranty` VARCHAR(100) NULL,
    `service_history` BOOLEAN NULL,
    `features` JSON NULL,
    `images` JSON NULL,
    `images_s3_keys` JSON NULL,
    `specs` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `price` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(10) NULL DEFAULT 'AED',

    UNIQUE INDEX `motor_listings_listing_id_key`(`listing_id`),
    INDEX `motor_listings_make_idx`(`make`),
    INDEX `motor_listings_year_idx`(`year`),
    INDEX `motor_listings_transmission_idx`(`transmission`),
    INDEX `motor_listings_fuel_type_idx`(`fuel_type`),
    INDEX `motor_listings_body_type_idx`(`body_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `job_listings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listing_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `price` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(10) NULL DEFAULT 'AED',
    `job_title` VARCHAR(200) NOT NULL,
    `company_name` VARCHAR(200) NOT NULL,
    `company_logo_url` VARCHAR(500) NULL,
    `company_logo_s3_key` VARCHAR(500) NULL,
    `industry` VARCHAR(100) NOT NULL,
    `job_type` VARCHAR(50) NOT NULL,
    `workplace_type` VARCHAR(50) NULL,
    `experience_min` INTEGER NULL,
    `experience_max` INTEGER NULL,
    `experience_level` VARCHAR(50) NULL,
    `education_required` VARCHAR(100) NULL,
    `salary_min` DECIMAL(12, 2) NULL,
    `salary_max` DECIMAL(12, 2) NULL,
    `salary_period` VARCHAR(20) NULL,
    `hide_salary` BOOLEAN NOT NULL DEFAULT false,
    `skills_required` JSON NULL,
    `languages_required` JSON NULL,
    `certifications_required` JSON NULL,
    `benefits` JSON NULL,
    `responsibilities` JSON NULL,
    `number_of_positions` INTEGER NOT NULL DEFAULT 1,
    `application_deadline` DATETIME(3) NULL,
    `application_email` VARCHAR(255) NULL,
    `application_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `job_listings_listing_id_key`(`listing_id`),
    INDEX `job_listings_industry_idx`(`industry`),
    INDEX `job_listings_job_type_idx`(`job_type`),
    INDEX `job_listings_experience_level_idx`(`experience_level`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `property_listings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listing_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `price` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(10) NULL DEFAULT 'AED',
    `listing_type` VARCHAR(20) NOT NULL,
    `property_type` VARCHAR(50) NOT NULL,
    `bedrooms` INTEGER NULL,
    `bathrooms` INTEGER NULL,
    `halls` INTEGER NULL,
    `area_sqft` DECIMAL(10, 2) NULL,
    `plot_size_sqft` DECIMAL(10, 2) NULL,
    `floor_number` INTEGER NULL,
    `total_floors` INTEGER NULL,
    `building_age` INTEGER NULL,
    `building_name` VARCHAR(200) NULL,
    `furnishing` VARCHAR(50) NULL,
    `condition` VARCHAR(50) NULL,
    `parking_spaces` INTEGER NULL,
    `rent_frequency` VARCHAR(20) NULL,
    `security_deposit` DECIMAL(12, 2) NULL,
    `number_of_cheques` INTEGER NULL,
    `amenities` JSON NULL,
    `nearby_places` JSON NULL,
    `ownership_type` VARCHAR(50) NULL,
    `developer_name` VARCHAR(200) NULL,
    `project_name` VARCHAR(200) NULL,
    `completion_date` DATETIME(3) NULL,
    `images` JSON NULL,
    `images_s3_keys` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `property_listings_listing_id_key`(`listing_id`),
    INDEX `property_listings_listing_type_idx`(`listing_type`),
    INDEX `property_listings_property_type_idx`(`property_type`),
    INDEX `property_listings_bedrooms_idx`(`bedrooms`),
    INDEX `property_listings_furnishing_idx`(`furnishing`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `classified_listings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listing_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `price` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(10) NULL DEFAULT 'AED',
    `sub_category` VARCHAR(100) NOT NULL,
    `condition` VARCHAR(50) NOT NULL,
    `brand` VARCHAR(100) NULL,
    `model` VARCHAR(100) NULL,
    `material` VARCHAR(100) NULL,
    `color` VARCHAR(50) NULL,
    `size` VARCHAR(50) NULL,
    `weight` DECIMAL(10, 2) NULL,
    `length_cm` DECIMAL(10, 2) NULL,
    `width_cm` DECIMAL(10, 2) NULL,
    `height_cm` DECIMAL(10, 2) NULL,
    `gender` VARCHAR(20) NULL,
    `age_group` VARCHAR(50) NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `is_handmade` BOOLEAN NULL,
    `year_of_purchase` INTEGER NULL,
    `warranty` VARCHAR(100) NULL,
    `features` JSON NULL,
    `images` JSON NULL,
    `images_s3_keys` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `classified_listings_listing_id_key`(`listing_id`),
    INDEX `classified_listings_sub_category_idx`(`sub_category`),
    INDEX `classified_listings_condition_idx`(`condition`),
    INDEX `classified_listings_brand_idx`(`brand`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `electronic_listings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listing_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `price` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(10) NULL DEFAULT 'AED',
    `sub_category` VARCHAR(100) NOT NULL,
    `brand` VARCHAR(100) NOT NULL,
    `model` VARCHAR(100) NOT NULL,
    `model_number` VARCHAR(100) NULL,
    `condition` VARCHAR(50) NOT NULL,
    `storage` VARCHAR(50) NULL,
    `ram` VARCHAR(50) NULL,
    `processor` VARCHAR(100) NULL,
    `operating_system` VARCHAR(50) NULL,
    `screen_size` DECIMAL(5, 2) NULL,
    `resolution` VARCHAR(50) NULL,
    `display_type` VARCHAR(50) NULL,
    `capacity` VARCHAR(50) NULL,
    `energy_rating` VARCHAR(10) NULL,
    `wattage` INTEGER NULL,
    `color` VARCHAR(50) NULL,
    `weight` DECIMAL(10, 2) NULL,
    `length_cm` DECIMAL(10, 2) NULL,
    `width_cm` DECIMAL(10, 2) NULL,
    `height_cm` DECIMAL(10, 2) NULL,
    `warranty_status` VARCHAR(50) NULL,
    `warranty_expiry` DATETIME(3) NULL,
    `purchase_date` DATETIME(3) NULL,
    `has_original_box` BOOLEAN NULL,
    `has_charger` BOOLEAN NULL,
    `accessories` JSON NULL,
    `imei_number` VARCHAR(20) NULL,
    `serial_number` VARCHAR(100) NULL,
    `features` JSON NULL,
    `images` JSON NULL,
    `images_s3_keys` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `electronic_listings_listing_id_key`(`listing_id`),
    INDEX `electronic_listings_sub_category_idx`(`sub_category`),
    INDEX `electronic_listings_brand_idx`(`brand`),
    INDEX `electronic_listings_condition_idx`(`condition`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `furniture_listings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listing_id` INTEGER NOT NULL,
    `name` VARCHAR(100) NULL,
    `phone` VARCHAR(20) NULL,
    `price` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(10) NULL DEFAULT 'AED',
    `sub_category` VARCHAR(100) NOT NULL,
    `condition` VARCHAR(50) NOT NULL,
    `style` VARCHAR(50) NULL,
    `primary_material` VARCHAR(100) NULL,
    `secondary_material` VARCHAR(100) NULL,
    `wood_type` VARCHAR(50) NULL,
    `color` VARCHAR(50) NULL,
    `finish` VARCHAR(50) NULL,
    `length_cm` DECIMAL(10, 2) NULL,
    `width_cm` DECIMAL(10, 2) NULL,
    `height_cm` DECIMAL(10, 2) NULL,
    `weight` DECIMAL(10, 2) NULL,
    `seating_capacity` INTEGER NULL,
    `bed_size` VARCHAR(50) NULL,
    `mattress_included` BOOLEAN NULL,
    `number_of_drawers` INTEGER NULL,
    `number_of_shelves` INTEGER NULL,
    `storage_capacity` VARCHAR(50) NULL,
    `assembly_required` BOOLEAN NULL,
    `delivery_available` BOOLEAN NULL,
    `brand` VARCHAR(100) NULL,
    `set_of` INTEGER NULL,
    `features` JSON NULL,
    `images` JSON NULL,
    `images_s3_keys` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `furniture_listings_listing_id_key`(`listing_id`),
    INDEX `furniture_listings_sub_category_idx`(`sub_category`),
    INDEX `furniture_listings_condition_idx`(`condition`),
    INDEX `furniture_listings_primary_material_idx`(`primary_material`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `favorites` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `listing_id` INTEGER NOT NULL,
    `images_s3_keys` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `images` JSON NULL,

    INDEX `favorites_user_id_idx`(`user_id`),
    INDEX `favorites_listing_id_idx`(`listing_id`),
    UNIQUE INDEX `favorites_user_id_listing_id_key`(`user_id`, `listing_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recently_viewed` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `listing_id` INTEGER NOT NULL,
    `viewed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `recently_viewed_user_id_idx`(`user_id`),
    INDEX `recently_viewed_viewed_at_idx`(`viewed_at`),
    INDEX `recently_viewed_listing_id_fkey`(`listing_id`),
    UNIQUE INDEX `recently_viewed_user_id_listing_id_key`(`user_id`, `listing_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_rooms` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `buyer_id` INTEGER NOT NULL,
    `listing_id` INTEGER NULL,
    `seller_id` INTEGER NOT NULL,
    `is_blocked` BOOLEAN NOT NULL DEFAULT false,
    `blocked_by` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `chat_rooms_buyer_id_idx`(`buyer_id`),
    INDEX `chat_rooms_seller_id_idx`(`seller_id`),
    INDEX `chat_rooms_listing_id_idx`(`listing_id`),
    UNIQUE INDEX `chat_rooms_listing_id_buyer_id_seller_id_key`(`listing_id`, `buyer_id`, `seller_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chat_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `room_id` INTEGER NOT NULL,
    `sender_id` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `chat_messages_room_id_idx`(`room_id`),
    INDEX `chat_messages_sender_id_idx`(`sender_id`),
    INDEX `chat_messages_room_id_created_at_idx`(`room_id`, `created_at`),
    INDEX `chat_messages_is_read_idx`(`is_read`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reported_users` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `reported_user_id` INTEGER NOT NULL,
    `reporter_id` INTEGER NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `details` TEXT NULL,
    `status` ENUM('pending', 'reviewed', 'dismissed', 'actioned') NOT NULL DEFAULT 'pending',
    `reviewed_by` INTEGER NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reported_users_reported_user_id_idx`(`reported_user_id`),
    INDEX `reported_users_reporter_id_idx`(`reporter_id`),
    INDEX `reported_users_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reported_listings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listing_id` INTEGER NOT NULL,
    `reporter_id` INTEGER NOT NULL,
    `reason` VARCHAR(255) NOT NULL,
    `details` TEXT NULL,
    `status` ENUM('pending', 'reviewed', 'dismissed', 'actioned') NOT NULL DEFAULT 'pending',
    `reviewed_by` INTEGER NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reported_listings_listing_id_idx`(`listing_id`),
    INDEX `reported_listings_reporter_id_idx`(`reporter_id`),
    INDEX `reported_listings_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fraud_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `type` VARCHAR(100) NOT NULL,
    `details` JSON NOT NULL,
    `risk_score` INTEGER NOT NULL,
    `is_reviewed` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `fraud_logs_user_id_idx`(`user_id`),
    INDEX `fraud_logs_type_idx`(`type`),
    INDEX `fraud_logs_risk_score_idx`(`risk_score`),
    INDEX `fraud_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `query` VARCHAR(500) NOT NULL,
    `filters` JSON NULL,
    `results_count` INTEGER NOT NULL DEFAULT 0,
    `ip_address` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `images` JSON NULL,

    INDEX `search_logs_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_tickets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NULL,
    `subject` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `status` ENUM('open', 'in_progress', 'resolved', 'closed') NOT NULL DEFAULT 'open',
    `priority` ENUM('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `support_tickets_user_id_idx`(`user_id`),
    INDEX `support_tickets_status_idx`(`status`),
    INDEX `support_tickets_priority_idx`(`priority`),
    INDEX `support_tickets_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_ticket_messages` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `ticket_id` INTEGER NOT NULL,
    `sender_id` INTEGER NULL,
    `sender_type` VARCHAR(20) NOT NULL,
    `message` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `support_ticket_messages_ticket_id_idx`(`ticket_id`),
    INDEX `support_ticket_messages_sender_id_idx`(`sender_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `type` ENUM('listing_approved', 'listing_rejected', 'listing_expired', 'new_message', 'price_alert', 'new_favorite', 'support_reply', 'system', 'booking_request', 'booking_confirmed', 'booking_rejected', 'booking_cancelled', 'booking_reminder', 'new_review', 'review_response') NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `message` TEXT NOT NULL,
    `data` JSON NULL,
    `is_read` BOOLEAN NOT NULL DEFAULT false,
    `read_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_user_id_idx`(`user_id`),
    INDEX `notifications_user_id_is_read_idx`(`user_id`, `is_read`),
    INDEX `notifications_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_config` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `system_config_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `bio` TEXT NOT NULL,
    `tagline` VARCHAR(255) NULL,
    `location` VARCHAR(200) NOT NULL,
    `city` VARCHAR(100) NULL,
    `country` VARCHAR(100) NULL,
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `service_radius` INTEGER NULL,
    `services` JSON NOT NULL,
    `specializations` JSON NULL,
    `hourly_rate` DECIMAL(10, 2) NULL,
    `consultation_fee` DECIMAL(10, 2) NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'AED',
    `photos` JSON NULL,
    `portfolio_url` VARCHAR(500) NULL,
    `years_experience` INTEGER NULL,
    `certifications` JSON NULL,
    `education` TEXT NULL,
    `languages` JSON NULL,
    `available_days` JSON NULL,
    `available_time_start` VARCHAR(10) NULL,
    `available_time_end` VARCHAR(10) NULL,
    `is_available` BOOLEAN NOT NULL DEFAULT true,
    `rating` DECIMAL(3, 2) NOT NULL DEFAULT 0.00,
    `total_reviews` INTEGER NOT NULL DEFAULT 0,
    `completed_projects` INTEGER NOT NULL DEFAULT 0,
    `is_verified` BOOLEAN NOT NULL DEFAULT false,
    `verified_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `featured_until` DATETIME(3) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `designers_user_id_key`(`user_id`),
    INDEX `designers_user_id_idx`(`user_id`),
    INDEX `designers_location_idx`(`location`),
    INDEX `designers_city_idx`(`city`),
    INDEX `designers_is_active_idx`(`is_active`),
    INDEX `designers_is_verified_idx`(`is_verified`),
    INDEX `designers_rating_idx`(`rating`),
    INDEX `designers_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designer_portfolios` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `designer_id` INTEGER NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `project_type` VARCHAR(100) NOT NULL,
    `style` VARCHAR(100) NULL,
    `images` JSON NOT NULL,
    `before_images` JSON NULL,
    `after_images` JSON NULL,
    `location` VARCHAR(200) NULL,
    `area` INTEGER NULL,
    `budget` VARCHAR(100) NULL,
    `duration` VARCHAR(100) NULL,
    `completed_at` DATETIME(3) NULL,
    `tags` JSON NULL,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `designer_portfolios_designer_id_idx`(`designer_id`),
    INDEX `designer_portfolios_project_type_idx`(`project_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designer_bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `designer_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `date_time` DATETIME(3) NOT NULL,
    `duration` INTEGER NOT NULL DEFAULT 60,
    `end_time` DATETIME(3) NULL,
    `booking_type` VARCHAR(50) NOT NULL,
    `status` ENUM('pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no_show') NOT NULL DEFAULT 'pending',
    `user_notes` TEXT NULL,
    `designer_notes` TEXT NULL,
    `cancelled_by` INTEGER NULL,
    `cancelled_at` DATETIME(3) NULL,
    `cancellation_reason` TEXT NULL,
    `rejection_reason` TEXT NULL,
    `meeting_type` VARCHAR(50) NULL,
    `meeting_location` TEXT NULL,
    `meeting_link` VARCHAR(500) NULL,
    `fee` DECIMAL(10, 2) NULL,
    `currency` VARCHAR(10) NOT NULL DEFAULT 'AED',
    `is_paid` BOOLEAN NOT NULL DEFAULT false,
    `paid_at` DATETIME(3) NULL,
    `confirmed_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `reminder_sent` BOOLEAN NOT NULL DEFAULT false,
    `reminder_sent_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `project_description` TEXT NULL,
    `project_type` VARCHAR(100) NULL,
    `user_address` VARCHAR(500) NULL,
    `user_name` VARCHAR(100) NULL,
    `user_phone` VARCHAR(20) NULL,

    INDEX `designer_bookings_designer_id_idx`(`designer_id`),
    INDEX `designer_bookings_user_id_idx`(`user_id`),
    INDEX `designer_bookings_status_idx`(`status`),
    INDEX `designer_bookings_date_time_idx`(`date_time`),
    INDEX `designer_bookings_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `designer_reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `designer_id` INTEGER NOT NULL,
    `user_id` INTEGER NOT NULL,
    `booking_id` INTEGER NULL,
    `rating` INTEGER NOT NULL,
    `communication_rating` INTEGER NULL,
    `professionalism_rating` INTEGER NULL,
    `quality_rating` INTEGER NULL,
    `value_rating` INTEGER NULL,
    `title` VARCHAR(255) NULL,
    `comment` TEXT NOT NULL,
    `photos` JSON NULL,
    `response` TEXT NULL,
    `responded_at` DATETIME(3) NULL,
    `is_approved` BOOLEAN NOT NULL DEFAULT false,
    `approved_at` DATETIME(3) NULL,
    `approved_by` INTEGER NULL,
    `is_hidden` BOOLEAN NOT NULL DEFAULT false,
    `hidden_reason` VARCHAR(255) NULL,
    `helpful_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `designer_reviews_booking_id_key`(`booking_id`),
    INDEX `designer_reviews_designer_id_idx`(`designer_id`),
    INDEX `designer_reviews_user_id_idx`(`user_id`),
    INDEX `designer_reviews_rating_idx`(`rating`),
    INDEX `designer_reviews_is_approved_idx`(`is_approved`),
    INDEX `designer_reviews_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_notes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `listing_id` INTEGER NOT NULL,
    `admin_id` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `is_internal` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `images` JSON NULL,
    `images_s3_keys` JSON NULL,

    INDEX `admin_notes_admin_id_idx`(`admin_id`),
    INDEX `admin_notes_created_at_idx`(`created_at`),
    INDEX `admin_notes_listing_id_idx`(`listing_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `actor_user_id` INTEGER NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(50) NULL,
    `entity_id` INTEGER NULL,
    `metadata` JSON NULL,
    `ip_address` VARCHAR(50) NULL,
    `device_info` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_action_idx`(`action`),
    INDEX `audit_logs_actor_user_id_idx`(`actor_user_id`),
    INDEX `audit_logs_created_at_idx`(`created_at`),
    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `category` VARCHAR(50) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `permissions_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OtpRequest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `otpHash` VARCHAR(191) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `verifiedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OtpRequest_phone_idx`(`phone`),
    INDEX `OtpRequest_email_idx`(`email`),
    INDEX `OtpRequest_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `role_permissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `role_id` INTEGER NOT NULL,
    `permission_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `role_permissions_permission_id_idx`(`permission_id`),
    INDEX `role_permissions_role_id_idx`(`role_id`),
    UNIQUE INDEX `role_permissions_role_id_permission_id_key`(`role_id`, `permission_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_job_listing_id_fkey` FOREIGN KEY (`job_listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_reviewed_by_fkey` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_applications` ADD CONSTRAINT `job_applications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listings` ADD CONSTRAINT `listings_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listings` ADD CONSTRAINT `listings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `listing_images` ADD CONSTRAINT `listing_images_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `motor_listings` ADD CONSTRAINT `motor_listings_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `job_listings` ADD CONSTRAINT `job_listings_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `property_listings` ADD CONSTRAINT `property_listings_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `classified_listings` ADD CONSTRAINT `classified_listings_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `electronic_listings` ADD CONSTRAINT `electronic_listings_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `furniture_listings` ADD CONSTRAINT `furniture_listings_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recently_viewed` ADD CONSTRAINT `recently_viewed_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recently_viewed` ADD CONSTRAINT `recently_viewed_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_rooms` ADD CONSTRAINT `chat_rooms_buyer_id_fkey` FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_rooms` ADD CONSTRAINT `chat_rooms_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_rooms` ADD CONSTRAINT `chat_rooms_seller_id_fkey` FOREIGN KEY (`seller_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `chat_rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reported_users` ADD CONSTRAINT `reported_users_reported_user_id_fkey` FOREIGN KEY (`reported_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reported_users` ADD CONSTRAINT `reported_users_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reported_listings` ADD CONSTRAINT `reported_listings_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reported_listings` ADD CONSTRAINT `reported_listings_reporter_id_fkey` FOREIGN KEY (`reporter_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fraud_logs` ADD CONSTRAINT `fraud_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_ticket_messages` ADD CONSTRAINT `support_ticket_messages_sender_id_fkey` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `support_ticket_messages` ADD CONSTRAINT `support_ticket_messages_ticket_id_fkey` FOREIGN KEY (`ticket_id`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designers` ADD CONSTRAINT `designers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designer_portfolios` ADD CONSTRAINT `designer_portfolios_designer_id_fkey` FOREIGN KEY (`designer_id`) REFERENCES `designers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designer_bookings` ADD CONSTRAINT `designer_bookings_designer_id_fkey` FOREIGN KEY (`designer_id`) REFERENCES `designers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designer_bookings` ADD CONSTRAINT `designer_bookings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designer_reviews` ADD CONSTRAINT `designer_reviews_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `designer_bookings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designer_reviews` ADD CONSTRAINT `designer_reviews_designer_id_fkey` FOREIGN KEY (`designer_id`) REFERENCES `designers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `designer_reviews` ADD CONSTRAINT `designer_reviews_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_notes` ADD CONSTRAINT `admin_notes_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_notes` ADD CONSTRAINT `admin_notes_listing_id_fkey` FOREIGN KEY (`listing_id`) REFERENCES `listings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OtpRequest` ADD CONSTRAINT `OtpRequest_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_fkey` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
