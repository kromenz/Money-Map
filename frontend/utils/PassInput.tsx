import { useState } from "react";
import { MdLockOutline } from "react-icons/md";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string;
  name?: string;
}

export default function PasswordInput({
  placeholder,
  name,
  value,
  onChange,
  ...restProps
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative bg-gray-100 w-64 p-2 my-2 rounded-lg flex items-center">
      {" "}
      <MdLockOutline className="text-gray-500 m-2" />
      <input
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        name={name}
        value={value}
        onChange={onChange}
        className="flex-1 bg-gray-100 text-gray-800 text-sm outline-none pr-4"
        {...restProps}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="relative right-2 top-1/2 transform -translate-y-1/2 text-gray-500">
        {visible ? <FaEyeSlash /> : <FaEye />}{" "}
      </button>{" "}
    </div>
  );
}
