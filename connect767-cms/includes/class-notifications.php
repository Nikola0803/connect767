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
    /** Avoid duplicate approval emails when the review screen and the status transition fire together. */
    private static $approved_notifications_sent = [];

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
        add_action('c767_listing_submitted', [__CLASS__, 'on_listing_submitted'], 10, 3);
        add_action('c767_listing_approved', [__CLASS__, 'on_listing_approved']);
        add_action('transition_post_status', [__CLASS__, 'on_listing_status_changed'], 10, 3);
        add_action('c767_listing_rejected', [__CLASS__, 'on_listing_rejected']);
        add_action('c767_listing_payment_confirmed', [__CLASS__, 'on_listing_payment_confirmed']);
        add_action('c767_booking_submitted', [__CLASS__, 'on_booking_submitted'], 10, 2);
        add_action('c767_booking_confirmed', [__CLASS__, 'on_booking_confirmed']);
        add_action('c767_booking_cashout_requested', [__CLASS__, 'on_booking_cashout_requested'], 10, 3);
        add_action('c767_booking_payout_paid', [__CLASS__, 'on_booking_payout_paid']);
    }

    public static function mail_from()
    {
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

    /**
     * Keep new-listing alerts going to the directory inbox even when the
     * WordPress administration email is changed. The current admin address
     * remains a recipient, and duplicate/invalid addresses are discarded.
     */
    private static function listing_notification_recipients()
    {
        $recipients = [
            get_option('c767_listing_notification_email', 'infoconnect767@gmail.com'),
            get_option('admin_email'),
        ];

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

    // ---------- Registration ----------

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
        if (!wp_mail($user->user_email, $subject, $body)) {
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
        if (!wp_mail(get_option('admin_email'), $admin_subject, $admin_body, self::reply_to($user->user_email))) {
            error_log('Connect767 new-account admin email could not be sent for user ' . $user_id . '.');
        }
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
            if (!wp_mail($recipient, $admin_subject, $admin_body, $admin_headers)) {
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
            wp_mail($user->user_email, $owner_subject, $owner_body);
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
        if (!wp_mail($owner->user_email, $subject, $body, self::reply_to(get_option('admin_email')))) {
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
        wp_mail($owner->user_email, $subject, $body, self::reply_to(get_option('admin_email')));
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
            wp_mail($owner->user_email, $subject, $body);
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
        wp_mail(get_option('admin_email'), $admin_subject, $admin_body);
    }

    // ---------- Booking request ----------

    public static function on_booking_submitted($booking_id, $listing_id)
    {
        $listing = get_post($listing_id);
        if (!$listing) {
            return;
        }
        $owner = get_userdata($listing->post_author);

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
                "Hi %s,\n\n%s just requested a %s for \"%s\":\n\n%s\nEmail: %s\nPhone: %s\nNotes: %s\nPayment: %s\n\nTrack and manage this booking from your dashboard:\n%s",
                $owner->display_name ?: $owner->user_login,
                $name ?: 'Someone',
                $is_rental ? 'rental' : 'booking',
                $listing->post_title,
                $schedule,
                $email ?: 'not provided',
                $phone ?: 'not provided',
                $notes ?: '—',
                $amount_cents > 0 ? 'Awaiting online payment of $' . number_format($amount_cents / 100, 2) : 'No payment required',
                self::frontend_url('/dashboard')
            );
            wp_mail($owner->user_email, $subject, $body, self::reply_to($email));
        }

        // Customer: confirmation their request went through.
        if ($email && is_email($email)) {
            $subject = sprintf('Your booking request to %s', $listing->post_title);
            if ($amount_cents > 0 && $is_rental) {
                $body = sprintf(
                    "Hi %s,\n\nYour rental request to \"%s\" was created for %d %s%s. Complete payment on the booking screen to confirm it.\n\n— %s",
                    $name ?: 'there', $listing->post_title, $units, $rate_unit, $units === 1 ? '' : 's', self::site_name()
                );
            } elseif ($amount_cents > 0) {
                $body = sprintf(
                    "Hi %s,\n\nYour appointment request to \"%s\" was created. Complete payment on the booking screen to confirm it and receive the meeting link.\n\n— %s",
                    $name ?: 'there', $listing->post_title, self::site_name()
                );
            } else {
                $body = sprintf(
                    "Hi %s,\n\nYour booking request to \"%s\" was sent. They'll reach out to you directly at this email or the phone number you provided to confirm.\n\n— %s",
                    $name ?: 'there', $listing->post_title, self::site_name()
                );
            }
            wp_mail($email, $subject, $body);
        }
    }

    public static function on_booking_confirmed($booking_id)
    {
        $listing_id = (int) get_post_meta($booking_id, 'listing_id', true);
        $listing = get_post($listing_id);
        if (!$listing) {
            return;
        }

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
                    "Hi %s,\n\nYour rental with \"%s\" is confirmed.\n\nStart: %s\nEnd: %s\nRental: %d %s%s\n\nThe owner will contact you with the remaining details.\n\n— %s",
                    $name ?: 'there', $listing->post_title, $check_in, $check_out, $units, $rate_unit, $units === 1 ? '' : 's', self::site_name()
                )
                : sprintf(
                    "Hi %s,\n\nYour booking with \"%s\" is confirmed.\n\nDate: %s\nTime: %s\nDuration: %d minutes\nMeeting link: %s\n\nKeep this email private; the meeting link is intended for you.\n\n— %s",
                    $name ?: 'there', $listing->post_title, $date ?: 'To be arranged', $time ?: 'To be arranged', $duration,
                    $meeting_url ?: 'The business will send this separately.', self::site_name()
                );
            wp_mail($email, $subject, $body);
        }

        if ($owner) {
            wp_mail(
                $owner->user_email,
                sprintf('Booking confirmed — %s', $listing->post_title),
                $is_rental
                    ? sprintf("%s's rental is confirmed from %s to %s. Manage it from your dashboard:\n%s", $name ?: 'A customer', $check_in, $check_out, self::frontend_url('/dashboard'))
                    : sprintf("%s's booking is confirmed for %s at %s. Manage it from your dashboard:\n%s", $name ?: 'A customer', $date ?: 'a date to be arranged', $time ?: 'a time to be arranged', self::frontend_url('/dashboard')),
                self::reply_to($email)
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
}
