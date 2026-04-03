function Button({ children = "Button", type = "button", ...props }) {
  return (
    <button type={type} {...props}>
      {children}
    </button>
  );
}

export default Button;
