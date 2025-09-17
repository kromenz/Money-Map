import { useState } from "react";
import { FaRegEnvelope } from "react-icons/fa";
import PasswordInput from "../utils/PassInput";

export default function SignUpSection({ isSignup }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const criteria = [
    {
      label: "At least 8 characters",
      test: (pw) => pw.length >= 8,
    },
    {
      label: "At least 1 uppercase letter",
      test: (pw) => /[A-Z]/.test(pw),
    },
    {
      label: "At least 1 number",
      test: (pw) => /\d/.test(pw),
    },
    {
      label: "At least 1 special character",
      test: (pw) => /[!@#$%^&*]/.test(pw),
    },
  ];

  const allPassed = criteria.every((c) => c.test(password));
  const passwordsMatch = password && password === confirm;

  return (
    <div
      className="absolute inset-y-0 right-0 w-1/2 space-y-4 flex flex-col items-center justify-center p-8 text-white transition-opacity duration-500"
      style={{
        opacity: isSignup ? 1 : 0,
        pointerEvents: isSignup ? "auto" : "none",
      }}>
      <h2 className="text-3xl font-bold text-gray-300 mb-4">Sign Up</h2>

      <div className="bg-gray-100 w-64 p-2 rounded-lg flex items-center">
        <FaRegEnvelope className="text-gray-500 m-2" />
        <input
          type="email"
          placeholder="Email"
          name="email"
          className="flex-1 bg-gray-100 text-gray-800 text-sm outline-none"
        />
      </div>

      <PasswordInput
        placeholder="Password"
        name="passwordSignUp"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <PasswordInput
        placeholder="Repeat Password"
        name="confirmPassword"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />

      <ul className="w-64 text-sm space-y-1">
        {criteria.map((c, idx) => {
          const passed = c.test(password);
          return (
            <li
              key={idx}
              className={`flex items-center ${
                passed ? "text-green-400" : "text-gray-400"
              }`}>
              <span
                className={`inline-block w-2 h-2 mr-2 rounded-full border-2 flex-shrink-0 ${
                  passed ? "border-green-400 bg-green-400" : "border-gray-400"
                }`}
              />
              {c.label}
            </li>
          );
        })}
      </ul>

      <button
        disabled={!allPassed || !passwordsMatch}
        onClick={() => {
          console.log("Sign Up");
        }}
        className={`
          w-64 py-2 mt-2 rounded-full font-semibold
          border-2 border-white text-white
          transition-transform duration-300 hover:scale-105
          hover:shadow-lg hover:bg-white/10 hover:text-gray-100
          disabled:opacity-50 disabled:cursor-not-allowed
        `}>
        Create Account
      </button>
    </div>
  );
}
