<?php
/**
 * Central place for the transactional emails the rest of the plugin only
 * announces via do_action() and never actually sends. Every hook below
 * already fires from existing code (registration, listing submission,
 * review approve/reject, Classified payment confirmation, booking
 * requests) — this class is the first (and only) listener for each one.
 *
 * Kept separate from the REST/CPT classes that fire these hooks so the
 * "what happens on this event" list stays in one file instead of being
 * scattered across five others. Uses plain wp_mail() the same way
 * class-rest-product-quotes.php / class-rest-uniform-quotes.php already
 * do, for consistency — no HTML templates, no extra dependencies.
 */

if (!defined('ABSPATH')) {
    exit;
}

class C767_Notifications
{
    const PROFILE_REMINDER_HOOK = 'c767_profile_completion_reminder';
    const PROFILE_REMINDER_SWEEP_HOOK = 'c767_profile_completion_reminder_sweep';

    /** Avoid duplicate approval emails when the review screen and the status transition fire together. */
    private static $approved_notifications_sent = [];

    /** Per-message sender override used for directory account and listing mail. */
    private static $mail_from_override = '';

    private static function is_rental_booking($type)
    {
        return $type !== '' && $type !== 'appointment';
    }

    public static function init()
    {
        // Keep every transactional message on the public Connect767 domain.
        // Without these filters WordPress defaults to
        // wordpress@admin.connect767.com, which can make Brevo replace the
        // visible sender with its own brevosend.com relay address.
        add_filter('wp_mail_from', [__CLASS__, 'mail_from'], PHP_INT_MAX);
        add_filter('wp_mail_from_name', [__CLASS__, 'mail_from_name'], PHP_INT_MAX);

        add_action('c767_user_registered', [__CLASS__, 'on_user_registered'], 10, 2);
        add_action(self::PROFILE_REMINDER_HOOK, [__CLASS__, 'send_profile_completion_reminder'], 10, 2);
        add_action(self::PROFILE_REMINDER_SWEEP_HOOK, [__CLASS__, 'send_existing_account_profile_reminders']);
        add_action('init', [__CLASS__, 'maybe_schedule_profile_reminder_sweep']);
        add_action('c767_listing_submitted', [__CLASS__, 'on_listing_submitted'], 10, 3);
        add_action('c767_listing_approved', [__CLASS__, 'on_listing_approved']);
        add_action('transition_post_status', [__CLASS__, 'on_listing_status_changed'], 10, 3);
        add_action('c767_listing_rejected', [__CLASS__, 'on_listing_rejected']);
        add_action('c767_listing_payment_confirmed', [__CLASS__, 'on_listing_payment_confirmed']);
        add_action('c767_booking_submitted', [__CLASS__, 'on_booking_submitted'], 10, 2);
        add_action('c767_booking_confirmed', [__CLASS__, 'on_booking_confirmed']);
        add_action('c767_booking_cashout_requested', [__CLASS__, 'on_booking_cashout_requested'], 10, 3);
        add_action('c767_booking_payout_paid', [__CLASS__, 'on_booking_payout_paid']);
        add_action('c767_vendor_order_paid', [__CLASS__, 'on_vendor_order_paid']);
        add_action('c767_vendor_payout_paid', [__CLASS__, 'on_vendor_payout_paid']);
    }

    public static function mail_from()
    {
        if (self::$mail_from_override && is_email(self::$mail_from_override)) {
            return self::$mail_from_override;
        }

        $email = defined('C767_MAIL_FROM') && C767_MAIL_FROM
            ? C767_MAIL_FROM
            : 'info@connect767.com';

        return is_email($email) ? $email : 'info@connect767.com';
    }

    public static function mail_from_name()
    {
        return 'Connect767';
    }

    private static function site_name()
    {
        return get_bloginfo('name') ?: 'Connect767';
    }

    /** Reply-To header so an admin can just hit reply and land in the customer's inbox. */
    private static function reply_to($email)
    {
        return $email && is_email($email) ? ['Reply-To: ' . $email] : [];
    }

    /** Render transactional booking messages as HTML so every URL is an explicit clickable link. */
    private static function booking_email_html($body)
    {
        $linked_body = make_clickable(esc_html((string) $body));
        $favicon = sprintf(
            '<img src="%s" alt="Connect767" width="36" height="36" style="display:block;width:36px;height:36px;object-fit:contain;border:0;" />',
            esc_url(self::frontend_url('/connect767-favicon.png'))
        );
        $linked_body = str_replace('__C767_FAVICON__', $favicon, $linked_body);

        return '<div style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#172019;">'
            . nl2br($linked_body)
            . '</div>';
    }

    /** Preserve optional Reply-To headers while sending a standards-compliant HTML email. */
    private static function booking_email_headers($headers = [])
    {
        return array_merge((array) $headers, ['Content-Type: text/html; charset=UTF-8']);
    }

    private static function directory_mail_from()
    {
        $email = sanitize_email((string) get_option('c767_directory_mail_from', 'no-reply@connect767.com'));
        return is_email($email) ? $email : 'no-reply@connect767.com';
    }

    /** Send directory notifications through the dedicated verified Brevo identity. */
    private static function send_directory_mail($to, $subject, $body, $headers = [])
    {
        self::$mail_from_override = self::directory_mail_from();
        $headers = array_merge((array) $headers, ['BIMI-Selector: v=BIMI1; s=default;']);
        try {
            return wp_mail($to, $subject, $body, $headers);
        } finally {
            self::$mail_from_override = '';
        }
    }

    /**
     * Keep directory account and listing alerts going to the dedicated inbox
     * even when the WordPress administration email is changed.
     */
    private static function listing_notification_recipients()
    {
        $recipients = [get_option('c767_listing_notification_email', 'no-reply@connect767.com')];

        $recipients = apply_filters('c767_listing_notification_recipients', $recipients);
        if (!is_array($recipients)) {
            $recipients = [];
        }

        $valid_recipients = [];
        foreach ($recipients as $recipient) {
            $email = strtolower(sanitize_email((string) $recipient));
            if ($email && is_email($email)) {
                $valid_recipients[$email] = $email;
            }
        }

        return array_values($valid_recipients);
    }

    private static function frontend_url($path = '/')
    {
        return c767_frontend_url($path);
    }

    /** Notify a listing owner when another business mentions them in the community feed. */
    public static function send_community_mention($recipient_user_id, $actor_user_id, $post_id, $business_name = '')
    {
        $recipient = get_userdata((int) $recipient_user_id);
        $actor = get_userdata((int) $actor_user_id);
        if (!$recipient || !is_email($recipient->user_email) || (int) $recipient_user_id === (int) $actor_user_id) {
            return false;
        }

        $actor_name = sanitize_text_field($business_name ?: ($actor ? ($actor->display_name ?: $actor->user_login) : 'A Connect767 business'));
        $post_url = self::frontend_url('/community#community-post-' . (int) $post_id);
        $subject = sprintf('%s mentioned you on Connect767', $actor_name);
        $body = sprintf(
            "Hi %s,\n\n%s mentioned your business in a Connect767 Community Feed update.\n\nView the update:\n%s\n\nYou are receiving this message because your published directory listing was mentioned.\n\n— Connect767",
            $recipient->display_name ?: $recipient->user_login,
            $actor_name,
            $post_url
        );

        $sent = self::send_directory_mail($recipient->user_email, $subject, $body);
        if (!$sent) {
            error_log('Connect767 community mention email could not be sent to user ' . (int) $recipient_user_id . ' for post ' . (int) $post_id . '.');
        }
        return $sent;
    }

    // ---------- Registration ----------

    /** Keep the exact registration reminders prompt while a twice-daily sweep catches older accounts and missed cron events. */
    public static function maybe_schedule_profile_reminder_sweep()
    {
        if (!wp_next_scheduled(self::PROFILE_REMINDER_SWEEP_HOOK)) {
            wp_schedule_event(time() + 5 * MINUTE_IN_SECONDS, 'twicedaily', self::PROFILE_REMINDER_SWEEP_HOOK);
        }
    }

    public static function clear_profile_reminder_schedule()
    {
        wp_clear_scheduled_hook(self::PROFILE_REMINDER_SWEEP_HOOK);
        $user_ids = get_users([
            'fields' => 'ids',
            'role__in' => ['subscriber'],
        ]);
        foreach ($user_ids as $user_id) {
            self::clear_profile_completion_reminders($user_id);
        }
    }

    private static function profile_reminder_meta_key($stage)
    {
        return 'c767_profile_reminder_' . (int) $stage . '_sent_at';
    }

    private static function user_has_listing($user_id)
    {
        $listing_ids = get_posts([
            'author' => (int) $user_id,
            'fields' => 'ids',
            'numberposts' => 1,
            'post_status' => 'any',
            'post_type' => 'listing',
            'suppress_filters' => true,
        ]);

        return !empty($listing_ids);
    }

    private static function schedule_profile_completion_reminders($user_id)
    {
        $user_id = (int) $user_id;
        if (!$user_id || self::user_has_listing($user_id)) {
            return;
        }

        $events = [
            1 => time() + 4 * HOUR_IN_SECONDS,
            2 => time() + 3 * DAY_IN_SECONDS,
        ];

        foreach ($events as $stage => $timestamp) {
            $args = [$user_id, $stage];
            if (!get_user_meta($user_id, self::profile_reminder_meta_key($stage), true)
                && !wp_next_scheduled(self::PROFILE_REMINDER_HOOK, $args)) {
                wp_schedule_single_event($timestamp, self::PROFILE_REMINDER_HOOK, $args);
            }
        }
    }

    private static function clear_profile_completion_reminders($user_id)
    {
        $user_id = (int) $user_id;
        foreach ([1, 2] as $stage) {
            wp_clear_scheduled_hook(self::PROFILE_REMINDER_HOOK, [$user_id, $stage]);
        }
    }

    private static function profile_reminder_email($user, $stage, $listing_url)
    {
        $name = $user->display_name ?: $user->user_login;
        $is_follow_up = (int) $stage === 2;
        $favicon_url = self::frontend_url('/connect767-favicon.png');
        $website_url = self::frontend_url('/');
        $subject = $is_follow_up
            ? 'Your Connect767 directory listing is waiting'
            : 'Complete your Connect767 directory profile';
        $intro = $is_follow_up
            ? 'Your Connect767 account is active, but your directory profile is not complete. Complete your profile by creating a directory listing so local customers can discover you and your business, products, or services.'
            : 'Your Connect767 account is ready. Complete your profile by creating a directory listing so local customers can discover you and your business, products, or services.';
        $supporting_copy = $is_follow_up
            ? 'Add your category, industry, experience, contact details, and photos. It only takes a few minutes, and you can begin with a free listing and update it whenever your business changes.'
            : 'Add your category, industry, experience, contact details, and photos to create a professional profile that is ready to share.';

        $html = sprintf(
            '<div style="margin:0;padding:32px 16px;background:#f8f5ef;font-family:Arial,sans-serif;color:#172019;">'
            . '<div style="max-width:620px;margin:0 auto;padding:36px;border:1px solid #e4ded2;border-radius:18px;background:#fffdf9;">'
            . '<p style="margin:0 0 20px;color:#006a46;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;">Connect767 Directory</p>'
            . '<h1 style="margin:0 0 18px;font-family:Georgia,serif;font-size:30px;line-height:1.2;color:#111a14;">%s</h1>'
            . '<p style="margin:0 0 16px;font-size:16px;line-height:1.7;">%s</p>'
            . '<p style="margin:0 0 26px;font-size:16px;line-height:1.7;">%s</p>'
            . '<a href="%s" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#006a46;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;">Create or update your listing &rarr;</a>'
            . '<p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#5d675f;">If the button does not open, copy this link into your browser:<br><a href="%s" style="color:#006a46;word-break:break-all;">%s</a></p>'
            . '<p style="margin:24px 0 0;padding-top:20px;border-top:1px solid #ece6dc;font-size:13px;line-height:1.6;color:#5d675f;">Already created your listing? No action is needed. Connect767 checks automatically and stops these reminders once a listing exists.</p>'
            . '<p style="margin:24px 0 10px;"><img src="%s" alt="Connect767 C" width="38" height="38" style="display:block;width:38px;height:38px;border:0;object-fit:contain;" /></p>'
            . '<p style="margin:0;font-size:15px;line-height:1.6;color:#172019;"><strong>The Connect767 Team</strong><br><a href="%s" style="color:#006a46;text-decoration:none;">connect767.com</a></p>'
            . '</div></div>',
            esc_html('Hi ' . $name . ','),
            esc_html($intro),
            esc_html($supporting_copy),
            esc_url($listing_url),
            esc_url($listing_url),
            esc_html($listing_url),
            esc_url($favicon_url),
            esc_url($website_url)
        );

        return [$subject, $html];
    }

    public static function send_profile_completion_reminder($user_id, $stage = 1)
    {
        $user_id = (int) $user_id;
        $stage = (int) $stage === 2 ? 2 : 1;
        $meta_key = self::profile_reminder_meta_key($stage);
        $user = get_userdata($user_id);

        if (!$user || !is_email($user->user_email) || get_user_meta($user_id, $meta_key, true)) {
            return;
        }
        if (self::user_has_listing($user_id)) {
            self::clear_profile_completion_reminders($user_id);
            return;
        }
        if ($stage === 2 && !get_user_meta($user_id, self::profile_reminder_meta_key(1), true)) {
            self::send_profile_completion_reminder($user_id, 1);
            return;
        }

        $listing_url = add_query_arg([
            'onboarding' => 1,
            'tier' => 'free',
            'utm_source' => 'profile_reminder',
            'utm_medium' => 'email',
            'utm_campaign' => 'complete_listing',
            'reminder' => $stage,
        ], self::frontend_url('/listings/submit'));
        [$subject, $html] = self::profile_reminder_email($user, $stage, $listing_url);

        if (self::send_directory_mail(
            $user->user_email,
            $subject,
            $html,
            ['Content-Type: text/html; charset=UTF-8']
        )) {
            update_user_meta($user_id, $meta_key, time());
            if ($stage === 1 && !wp_next_scheduled(self::PROFILE_REMINDER_HOOK, [$user_id, 2])) {
                wp_schedule_single_event(time() + 3 * DAY_IN_SECONDS, self::PROFILE_REMINDER_HOOK, [$user_id, 2]);
            }
        } else {
            error_log('Connect767 profile-completion reminder could not be sent for user ' . $user_id . '.');
        }
    }

    /** Backfill reminders for existing subscriber accounts without directory listings. */
    public static function send_existing_account_profile_reminders()
    {
        $user_ids = get_users([
            'fields' => 'ids',
            'role__in' => ['subscriber'],
        ]);
        $now = time();

        foreach ($user_ids as $user_id) {
            $user = get_userdata((int) $user_id);
            if (!$user || self::user_has_listing($user_id)) {
                self::clear_profile_completion_reminders($user_id);
                continue;
            }

            $registered_at = strtotime($user->user_registered . ' UTC');
            $first_sent_at = (int) get_user_meta($user_id, self::profile_reminder_meta_key(1), true);
            $second_sent_at = (int) get_user_meta($user_id, self::profile_reminder_meta_key(2), true);

            if (!$first_sent_at && (!$registered_at || $registered_at <= $now - 4 * HOUR_IN_SECONDS)) {
                self::send_profile_completion_reminder($user_id, 1);
                continue;
            }
            if ($first_sent_at && !$second_sent_at && $first_sent_at <= $now - 3 * DAY_IN_SECONDS) {
                self::send_profile_completion_reminder($user_id, 2);
            }
        }
    }

    public static function on_user_registered($user_id, $account_type)
    {
        $user = get_userdata($user_id);
        if (!$user) {
            return;
        }

        // Welcome email to the new user.
        $is_business = $account_type === 'business';
        $subject = sprintf('Welcome to %s!', self::site_name());
        $body = $is_business
            ? sprintf(
                "Hi %s,\n\nYour Connect767 business account is ready. You can add your first listing here:\n%s\n\nManage everything (listings, bookings, orders) from your dashboard:\n%s\n\nThanks for joining us.",
                $user->display_name ?: $user->user_login,
                self::frontend_url('/listings/submit'),
                self::frontend_url('/dashboard')
            )
            : sprintf(
                "Hi %s,\n\nYour Connect767 account is ready. Browse the directory here:\n%s\n\nThanks for joining us.",
                $user->display_name ?: $user->user_login,
                self::frontend_url('/listings')
            );
        if (!self::send_directory_mail($user->user_email, $subject, $body)) {
            error_log('Connect767 welcome email could not be sent for user ' . $user_id . '.');
        }

        // Admin heads-up.
        $admin_subject = sprintf('[Connect767] New %s account — %s', $is_business ? 'business' : 'customer', $user->user_email);
        $admin_body = sprintf(
            "Name: %s\nEmail: %s\nAccount type: %s\nRegistered: %s\n\nView user: %s",
            $user->display_name ?: $user->user_login,
            $user->user_email,
            $is_business ? 'Business' : 'Customer',
            current_time('mysql'),
            admin_url('user-edit.php?user_id=' . $user_id)
        );
        foreach (self::listing_notification_recipients() as $recipient) {
            if (!self::send_directory_mail($recipient, $admin_subject, $admin_body, self::reply_to($user->user_email))) {
                error_log('Connect767 new-account directory email could not be sent for user ' . $user_id . '.');
            }
        }

        self::schedule_profile_completion_reminders($user_id);
    }

    /**
     * Sends the account owner to the headless frontend instead of exposing
     * the WordPress admin-domain reset screen.
     */
    public static function send_password_reset($user, $key)
    {
        if (!$user instanceof WP_User || !$key) {
            return false;
        }

        $reset_url = add_query_arg([
            'login' => $user->user_login,
            'key' => $key,
        ], self::frontend_url('/auth/reset-password'));

        $subject = sprintf('Reset your %s password', self::site_name());
        $body = sprintf(
            "Hi %s,\n\nWe received a request to reset your Connect767 password. Use the secure link below to choose a new password:\n%s\n\nThis link expires automatically. If you did not request a reset, you can safely ignore this email.\n\n— %s",
            $user->display_name ?: $user->user_login,
            $reset_url,
            self::site_name()
        );

        return wp_mail($user->user_email, $subject, $body);
    }

    // ---------- Listing submitted (pending review) ----------

    public static function on_listing_submitted($post_id, $user_id, $tier)
    {
        self::clear_profile_completion_reminders($user_id);
        $post = get_post($post_id);
        $user = get_userdata($user_id);
        if (!$post) {
            return;
        }

        // Admin: something is waiting in the review queue.
        $admin_subject = sprintf('[Connect767] New listing submitted for review — %s', $post->post_title);
        $admin_body = sprintf(
            "Business: %s\nTier: %s\nSubmitted by: %s\n\nReview it here: %s",
            $post->post_title,
            $tier,
            $user ? $user->user_email : 'Unknown',
            admin_url('admin.php?page=connect767-review-listings')
        );
        $admin_headers = self::reply_to($user ? $user->user_email : '');
        foreach (self::listing_notification_recipients() as $recipient) {
            if (!self::send_directory_mail($recipient, $admin_subject, $admin_body, $admin_headers)) {
                error_log(sprintf(
                    'Connect767 new-listing notification could not be sent to %s for listing %d.',
                    $recipient,
                    $post_id
                ));
            }
        }

        // Submitter: confirmation their listing is in the queue.
        if ($user) {
            $owner_subject = sprintf('We received your listing — %s', $post->post_title);
            $owner_body = sprintf(
                "Hi %s,\n\nThanks for submitting \"%s\" (%s tier) to %s. It's now waiting for a quick review before it goes live in the directory — we'll let you know as soon as that's done.\n\nYou can check its status any time from your dashboard:\n%s",
                $user->display_name ?: $user->user_login,
                $post->post_title,
                $tier,
                self::site_name(),
                self::frontend_url('/dashboard')
            );
            self::send_directory_mail($user->user_email, $owner_subject, $owner_body);
        }
    }

    // ---------- Listing approved / rejected ----------

    /**
     * Covers approvals made through either the Connect767 review queue or
     * WordPress's regular listing editor. New imports are excluded because
     * they were never submitted for administrator approval.
     */
    public static function on_listing_status_changed($new_status, $old_status, $post)
    {
        if (
            !$post instanceof WP_Post
            || $post->post_type !== 'listing'
            || $new_status !== 'publish'
            || !in_array($old_status, ['pending', 'draft', 'private', 'future'], true)
        ) {
            return;
        }

        do_action('c767_listing_approved', $post->ID);
    }

    public static function on_listing_approved($post_id)
    {
        if (isset(self::$approved_notifications_sent[$post_id])) {
            return;
        }

        $post = get_post($post_id);
        if (!$post) {
            return;
        }
        $owner = get_userdata($post->post_author);
        if (!$owner) {
            return;
        }

        self::$approved_notifications_sent[$post_id] = true;

        $subject = sprintf('Your Connect767 listing has been approved — %s', $post->post_title);
        $body = sprintf(
            "Hi %s,\n\nGood news — the website administrator approved \"%s\" and it is now live in the Connect767 directory.\n\nView your live listing:\n%s\n\nYou can update and manage it any time from your dashboard:\n%s\n\nThank you for being part of Connect767.",
            $owner->display_name ?: $owner->user_login,
            $post->post_title,
            self::frontend_url('/listings/' . $post->post_name),
            self::frontend_url('/dashboard')
        );
        if (!self::send_directory_mail($owner->user_email, $subject, $body, self::reply_to(self::directory_mail_from()))) {
            error_log('Connect767 listing-approval email could not be sent for listing ' . $post_id . '.');
        }
    }

    public static function on_listing_rejected($post_id)
    {
        $post = get_post($post_id);
        if (!$post) {
            return;
        }
        $owner = get_userdata($post->post_author);
        if (!$owner) {
            return;
        }

        $subject = sprintf('An update on your listing — %s', $post->post_title);
        $body = sprintf(
            "Hi %s,\n\nWe reviewed \"%s\" and weren't able to approve it as submitted. This is often just missing details or a category mismatch.\n\nYou're welcome to update it and resubmit from your dashboard:\n%s\n\nReply to this email if you'd like to know more about why it wasn't approved.",
            $owner->display_name ?: $owner->user_login,
            $post->post_title,
            self::frontend_url('/dashboard')
        );
        self::send_directory_mail($owner->user_email, $subject, $body, self::reply_to(self::directory_mail_from()));
    }

    // ---------- Classified tier payment confirmed ----------

    public static function on_listing_payment_confirmed($listing_id)
    {
        $post = get_post($listing_id);
        if (!$post) {
            return;
        }
        $owner = get_userdata($post->post_author);
        $tier = get_post_meta($listing_id, 'tier', true) ?: 'Classified';

        if ($owner) {
            $subject = sprintf('Payment received — %s upgrade confirmed', $tier);
            $body = sprintf(
                "Hi %s,\n\nWe've confirmed payment for your %s upgrade on \"%s\". If it's still pending review, it'll go live as soon as that's done — otherwise it's already reflected on your listing:\n%s\n\nManage billing and listings from your dashboard:\n%s",
                $owner->display_name ?: $owner->user_login,
                $tier,
                $post->post_title,
                self::frontend_url('/listings/' . $post->post_name),
                self::frontend_url('/dashboard')
            );
            self::send_directory_mail($owner->user_email, $subject, $body);
        }

        // Admin: revenue event worth a quiet heads-up.
        $admin_subject = sprintf('[Connect767] %s payment confirmed — %s', $tier, $post->post_title);
        $admin_body = sprintf(
            "Listing: %s\nTier: %s\nOwner: %s\n\nView in wp-admin: %s",
            $post->post_title,
            $tier,
            $owner ? $owner->user_email : 'Unknown',
            admin_url('post.php?post=' . $listing_id . '&action=edit')
        );
        foreach (self::listing_notification_recipients() as $recipient) {
            self::send_directory_mail($recipient, $admin_subject, $admin_body);
        }
    }

    // ---------- Booking request ----------

    public static function on_booking_submitted($booking_id, $listing_id)
    {
        // A paid booking is only confirmed after Stripe or PayPal succeeds.
        // Keep this guard here as well as at the submission call site so a
        // third-party action cannot accidentally send a pre-payment email.
        if ((int) get_post_meta($booking_id, 'amount_cents', true) > 0
            && get_post_meta($booking_id, 'payment_status', true) !== 'paid') {
            return;
        }

        $listing = get_post($listing_id);
        if (!$listing) {
            return;
        }
        $owner = get_userdata($listing->post_author);
        $listing_url = self::frontend_url('/listings/' . $listing->post_name);

        $name = get_post_meta($booking_id, 'name', true);
        $email = get_post_meta($booking_id, 'email', true);
        $phone = get_post_meta($booking_id, 'phone', true);
        $preferred_date = get_post_meta($booking_id, 'preferred_date', true);
        $preferred_time = get_post_meta($booking_id, 'preferred_time', true);
        $notes = get_post_meta($booking_id, 'notes', true);
        $amount_cents = (int) get_post_meta($booking_id, 'amount_cents', true);
        $booking_type = (string) get_post_meta($booking_id, 'booking_type', true) ?: 'appointment';
        $is_rental = self::is_rental_booking($booking_type);
        $check_in = get_post_meta($booking_id, 'check_in', true);
        $check_out = get_post_meta($booking_id, 'check_out', true);
        $units = (int) (get_post_meta($booking_id, 'units', true) ?: get_post_meta($booking_id, 'nights', true));
        $rate_unit = (string) get_post_meta($booking_id, 'rate_unit', true) ?: 'night';
        $schedule = $is_rental
            ? sprintf("Start: %s\nEnd: %s\nRental: %d %s%s", $check_in, $check_out, $units, $rate_unit, $units === 1 ? '' : 's')
            : sprintf("Preferred date: %s\nPreferred time: %s", $preferred_date ?: 'Not specified', $preferred_time ?: 'Not specified');

        // Business owner: a customer wants to book them.
        if ($owner) {
            $subject = sprintf('New booking request — %s', $listing->post_title);
            $body = sprintf(
                "Hi %s,\n\n%s just requested a %s for \"%s\":\n\n%s\nEmail: %s\nPhone: %s\nNotes: %s\nPayment: %s\n\nView the listing:\n%s\n\nTrack and manage this booking from your dashboard:\n%s",
                $owner->display_name ?: $owner->user_login,
                $name ?: 'Someone',
                $is_rental ? 'rental' : 'booking',
                $listing->post_title,
                $schedule,
                $email ?: 'not provided',
                $phone ?: 'not provided',
                $notes ?: '—',
                $amount_cents > 0 ? 'Awaiting online payment of $' . number_format($amount_cents / 100, 2) : 'No payment required',
                $listing_url,
                self::frontend_url('/dashboard')
            );
            wp_mail(
                $owner->user_email,
                $subject,
                self::booking_email_html($body),
                self::booking_email_headers(self::reply_to($email))
            );
        }

        // Customer: confirmation their request went through.
        if ($email && is_email($email)) {
            $subject = sprintf('Your booking request to %s', $listing->post_title);
            if ($amount_cents > 0 && $is_rental) {
                $body = sprintf(
                    "Hi %s,\n\nYour rental request to \"%s\" was created for %d %s%s. Complete payment on the booking screen to confirm it.\n\nView the listing:\n%s\n\n__C767_FAVICON__",
                    $name ?: 'there', $listing->post_title, $units, $rate_unit, $units === 1 ? '' : 's', $listing_url
                );
            } elseif ($amount_cents > 0) {
                $body = sprintf(
                    "Hi %s,\n\nYour appointment request to \"%s\" was created. Complete payment on the booking screen to confirm it and receive the meeting link.\n\nView the listing:\n%s\n\n__C767_FAVICON__",
                    $name ?: 'there', $listing->post_title, $listing_url
                );
            } else {
                $body = sprintf(
                    "Hi %s,\n\nYour booking request to \"%s\" was sent. They'll reach out to you directly at this email or the phone number you provided to confirm.\n\nView the listing:\n%s\n\n__C767_FAVICON__",
                    $name ?: 'there', $listing->post_title, $listing_url
                );
            }
            wp_mail($email, $subject, self::booking_email_html($body), self::booking_email_headers());
        }
    }

    public static function on_booking_confirmed($booking_id)
    {
        $listing_id = (int) get_post_meta($booking_id, 'listing_id', true);
        $listing = get_post($listing_id);
        if (!$listing) {
            return;
        }
        $listing_url = self::frontend_url('/listings/' . $listing->post_name);

        $name = get_post_meta($booking_id, 'name', true);
        $email = get_post_meta($booking_id, 'email', true);
        $date = get_post_meta($booking_id, 'preferred_date', true);
        $time = get_post_meta($booking_id, 'preferred_time', true);
        $duration = (int) (get_post_meta($booking_id, 'duration_minutes', true) ?: 30);
        $booking_type = (string) get_post_meta($booking_id, 'booking_type', true) ?: 'appointment';
        $is_rental = self::is_rental_booking($booking_type);
        $check_in = get_post_meta($booking_id, 'check_in', true);
        $check_out = get_post_meta($booking_id, 'check_out', true);
        $units = (int) (get_post_meta($booking_id, 'units', true) ?: get_post_meta($booking_id, 'nights', true));
        $rate_unit = (string) get_post_meta($booking_id, 'rate_unit', true) ?: 'night';
        $meeting_url = get_post_meta($listing_id, 'booking_meeting_url', true);
        $owner = get_userdata($listing->post_author);

        if ($email && is_email($email)) {
            $subject = sprintf('Booking confirmed — %s', $listing->post_title);
            $body = $is_rental
                ? sprintf(
                    "Hi %s,\n\nYour rental with \"%s\" is confirmed.\n\nStart: %s\nEnd: %s\nRental: %d %s%s\n\nView the listing:\n%s\n\nThe owner will contact you with the remaining details.\n\n__C767_FAVICON__",
                    $name ?: 'there', $listing->post_title, $check_in, $check_out, $units, $rate_unit, $units === 1 ? '' : 's', $listing_url
                )
                : sprintf(
                    "Hi %s,\n\nYour booking with \"%s\" is confirmed.\n\nDate: %s\nTime: %s\nDuration: %d minutes\nMeeting link: %s\n\nView the listing:\n%s\n\nKeep this email private; the meeting link is intended for you.\n\n__C767_FAVICON__",
                    $name ?: 'there', $listing->post_title, $date ?: 'To be arranged', $time ?: 'To be arranged', $duration,
                    $meeting_url ?: 'The business will send this separately.', $listing_url
                );
            wp_mail($email, $subject, self::booking_email_html($body), self::booking_email_headers());
        }

        if ($owner) {
            wp_mail(
                $owner->user_email,
                sprintf('Booking confirmed — %s', $listing->post_title),
                self::booking_email_html($is_rental
                    ? sprintf("%s's rental is confirmed from %s to %s.\n\nView the listing:\n%s\n\nManage it from your dashboard:\n%s", $name ?: 'A customer', $check_in, $check_out, $listing_url, self::frontend_url('/dashboard'))
                    : sprintf("%s's booking is confirmed for %s at %s.\n\nView the listing:\n%s\n\nManage it from your dashboard:\n%s", $name ?: 'A customer', $date ?: 'a date to be arranged', $time ?: 'a time to be arranged', $listing_url, self::frontend_url('/dashboard'))),
                self::booking_email_headers(self::reply_to($email))
            );
        }
    }

    public static function on_booking_cashout_requested($booking_id, $listing_id, $user_id)
    {
        $listing = get_post($listing_id);
        $owner = get_userdata($user_id);
        if (!$listing || !$owner) {
            return;
        }

        $amount_cents = (int) get_post_meta($booking_id, 'owner_payout_amount_cents', true);
        $method = (string) get_post_meta($booking_id, 'owner_payout_method', true);
        $subject = sprintf('[Connect767] Cash-out request — %s', $listing->post_title);
        $body = sprintf(
            "Listing: %s\nOwner: %s\nOwner email: %s\nPayout amount: $%s USD\nPayout method: %s\nBooking ID: %d\n\nVerify the saved destination and process this payout from the Connect767 payment account.\n\nOpen booking: %s",
            $listing->post_title,
            $owner->display_name ?: $owner->user_login,
            $owner->user_email,
            number_format($amount_cents / 100, 2),
            $method === 'digital' ? 'Digital payment' : 'Bank transfer',
            $booking_id,
            admin_url('post.php?post=' . $booking_id . '&action=edit')
        );
        wp_mail(get_option('admin_email'), $subject, $body, self::reply_to($owner->user_email));

        wp_mail(
            $owner->user_email,
            sprintf('Cash-out request received — %s', $listing->post_title),
            sprintf(
                "Hi %s,\n\nWe received your cash-out request for $%s USD from booking #%d. Connect767 will verify your saved payout destination and process the transfer. You can track the status from your dashboard:\n%s",
                $owner->display_name ?: $owner->user_login,
                number_format($amount_cents / 100, 2),
                $booking_id,
                self::frontend_url('/dashboard')
            )
        );
    }

    public static function on_booking_payout_paid($booking_id)
    {
        $listing_id = (int) get_post_meta($booking_id, 'listing_id', true);
        $listing = get_post($listing_id);
        $owner = $listing ? get_userdata($listing->post_author) : null;
        if (!$listing || !$owner) {
            return;
        }
        $amount_cents = (int) get_post_meta($booking_id, 'owner_payout_amount_cents', true);
        wp_mail(
            $owner->user_email,
            sprintf('Your Connect767 payout was sent — %s', $listing->post_title),
            sprintf(
                "Hi %s,\n\nYour $%s USD payout for booking #%d has been marked paid. Check your selected payout destination and contact Connect767 support if it does not arrive within the provider's stated transfer time.\n\nTrack your bookings:\n%s",
                $owner->display_name ?: $owner->user_login,
                number_format($amount_cents / 100, 2),
                $booking_id,
                self::frontend_url('/dashboard')
            )
        );
    }

    public static function on_vendor_order_paid($order_id)
    {
        $listing_id = (int) get_post_meta($order_id, 'listing_id', true);
        $product_id = (int) get_post_meta($order_id, 'product_id', true);
        $listing = get_post($listing_id);
        $product = get_post($product_id);
        $owner = $listing ? get_userdata($listing->post_author) : null;
        if (!$listing || !$product || !$owner) {
            return;
        }

        $gross = (int) get_post_meta($order_id, 'amount_cents', true);
        $fee = (int) get_post_meta($order_id, 'platform_fee_amount_cents', true);
        $payout = (int) get_post_meta($order_id, 'owner_payout_amount_cents', true);
        $buyer_email = sanitize_email((string) get_post_meta($order_id, 'buyer_email', true));

        wp_mail(
            $owner->user_email,
            sprintf('New paid storefront order — %s', $product->post_title),
            sprintf(
                "Hi %s,\n\nYou received a paid order for \"%s\" from your %s storefront.\n\nCustomer total: $%s USD\nConnect767 platform fee (10%% of product price): $%s USD\nYour payout: $%s USD\n\nReview delivery details and payout status in your dashboard:\n%s",
                $owner->display_name ?: $owner->user_login,
                $product->post_title,
                $listing->post_title,
                number_format($gross / 100, 2),
                number_format($fee / 100, 2),
                number_format($payout / 100, 2),
                self::frontend_url('/dashboard?products=' . $listing_id . '#products-services')
            ),
            self::reply_to($buyer_email)
        );

        wp_mail(
            get_option('admin_email'),
            sprintf('[Connect767] Paid storefront order #%d — %s', $order_id, $product->post_title),
            sprintf(
                "Listing: %s\nOwner: %s\nGross: $%s USD\nConnect767 fee retained: $%s USD\nOwner payout due: $%s USD\n\nManage storefront payouts:\n%s",
                $listing->post_title,
                $owner->display_name ?: $owner->user_login,
                number_format($gross / 100, 2),
                number_format($fee / 100, 2),
                number_format($payout / 100, 2),
                admin_url('admin.php?page=connect767-storefront-payouts')
            ),
            self::reply_to($owner->user_email)
        );
    }

    public static function on_vendor_payout_paid($order_id)
    {
        $listing_id = (int) get_post_meta($order_id, 'listing_id', true);
        $product_id = (int) get_post_meta($order_id, 'product_id', true);
        $listing = get_post($listing_id);
        $product = get_post($product_id);
        $owner = $listing ? get_userdata($listing->post_author) : null;
        if (!$listing || !$owner) {
            return;
        }

        $payout = (int) get_post_meta($order_id, 'owner_payout_amount_cents', true);
        wp_mail(
            $owner->user_email,
            sprintf('Your storefront payout was sent — %s', $product ? $product->post_title : $listing->post_title),
            sprintf(
                "Hi %s,\n\nYour $%s USD payout for storefront order #%d has been marked paid. The Connect767 10%% platform fee was retained before this payout.\n\nTrack your sales:\n%s",
                $owner->display_name ?: $owner->user_login,
                number_format($payout / 100, 2),
                $order_id,
                self::frontend_url('/dashboard?products=' . $listing_id . '#products-services')
            )
        );
    }
}
