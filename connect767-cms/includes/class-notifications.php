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
    public static function init()
    {
        add_action('c767_user_registered', [__CLASS__, 'on_user_registered'], 10, 2);
        add_action('c767_listing_submitted', [__CLASS__, 'on_listing_submitted'], 10, 3);
        add_action('c767_listing_approved', [__CLASS__, 'on_listing_approved']);
        add_action('c767_listing_rejected', [__CLASS__, 'on_listing_rejected']);
        add_action('c767_listing_payment_confirmed', [__CLASS__, 'on_listing_payment_confirmed']);
        add_action('c767_booking_submitted', [__CLASS__, 'on_booking_submitted'], 10, 2);
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

    private static function frontend_url($path = '/')
    {
        return untrailingslashit(home_url()) . '/' . ltrim($path, '/');
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
        wp_mail($user->user_email, $subject, $body);

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
        wp_mail(get_option('admin_email'), $admin_subject, $admin_body, self::reply_to($user->user_email));
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
        wp_mail(get_option('admin_email'), $admin_subject, $admin_body, self::reply_to($user ? $user->user_email : ''));

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

    public static function on_listing_approved($post_id)
    {
        $post = get_post($post_id);
        if (!$post) {
            return;
        }
        $owner = get_userdata($post->post_author);
        if (!$owner) {
            return;
        }

        $subject = sprintf('Your listing is live — %s', $post->post_title);
        $body = sprintf(
            "Hi %s,\n\nGood news — \"%s\" has been approved and is now live in the Connect767 directory:\n%s\n\nYou can manage it any time from your dashboard:\n%s",
            $owner->display_name ?: $owner->user_login,
            $post->post_title,
            self::frontend_url('/listings/' . $post->post_name),
            self::frontend_url('/dashboard')
        );
        wp_mail($owner->user_email, $subject, $body);
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

        // Business owner: a customer wants to book them.
        if ($owner) {
            $subject = sprintf('New booking request — %s', $listing->post_title);
            $body = sprintf(
                "Hi %s,\n\n%s just requested a booking for \"%s\":\n\nPreferred date: %s\nPreferred time: %s\nEmail: %s\nPhone: %s\nNotes: %s\n\nReach out to them directly to confirm — you can also track this from your dashboard:\n%s",
                $owner->display_name ?: $owner->user_login,
                $name ?: 'Someone',
                $listing->post_title,
                $preferred_date ?: 'Not specified',
                $preferred_time ?: 'Not specified',
                $email ?: 'not provided',
                $phone ?: 'not provided',
                $notes ?: '—',
                self::frontend_url('/dashboard')
            );
            wp_mail($owner->user_email, $subject, $body, self::reply_to($email));
        }

        // Customer: confirmation their request went through.
        if ($email && is_email($email)) {
            $subject = sprintf('Your booking request to %s', $listing->post_title);
            $body = sprintf(
                "Hi %s,\n\nYour booking request to \"%s\" was sent. They'll reach out to you directly at this email or the phone number you provided to confirm.\n\n— %s",
                $name ?: 'there',
                $listing->post_title,
                self::site_name()
            );
            wp_mail($email, $subject, $body);
        }
    }
}
