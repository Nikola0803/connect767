import { Link } from "react-router-dom";

const variants = {
  primary: "bg-primary-500 text-background-50 hover:bg-primary-600",
  accent: "bg-accent-500 text-background-50 hover:bg-accent-600",
  dark: "bg-foreground-950 text-background-50 hover:bg-foreground-800",
  outline: "border border-background-300 text-foreground-800 hover:bg-background-100",
  "outline-light": "border border-background-50/30 text-background-50 hover:bg-background-50/10",
  ghost: "text-foreground-700 hover:bg-background-100",
};

const sizes = {
  sm: "px-3.5 py-2 text-xs",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

/**
 * Shared button used across the app. Renders a <Link> when `to` is passed,
 * an <a> when `href` is passed, otherwise a <button>.
 */
export default function Button({
  to,
  href,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "right",
  className = "",
  children,
  ...props
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-md font-semibold cursor-pointer whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`;

  const content = (
    <>
      {icon && iconPosition === "left" && <i className={icon} />}
      {children}
      {icon && iconPosition === "right" && <i className={icon} />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {content}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {content}
      </a>
    );
  }
  return (
    <button type={props.type || "button"} className={classes} {...props}>
      {content}
    </button>
  );
}
