import { useState } from "react";
import Footer from "../components/Footer";
import DarkVeil from "../styles/DarkVeil/DarkVeil";
import { FaGoogle, FaRegEnvelope } from "react-icons/fa";
import PasswordInput from "../utils/PassInput";
import SignUpSection from "../components/SignUp";

export default function Home() {
  const [isSignup, setIsSignup] = useState(false);

  return (
    <div className="relative w-full h-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <DarkVeil
          hueShift={360}
          warpAmount={5}
          speed={1.5}
          resolutionScale={1}
        />
      </div>

      <div className="relative z-10 flex items-center justify-center w-full h-full px-20">
        <div className="relative w-full md:w-4/5 lg:w-3/5 h-[60vh] bg-white/20 backdrop-blur-lg border border-white/30 rounded-2xl shadow-2xl overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 w-1/2 space-y-4 flex flex-col items-center justify-center p-5 text-white transition-opacity duration-500"
            style={{
              opacity: isSignup ? 0 : 1,
              pointerEvents: isSignup ? "none" : "auto",
            }}>
            <h2 className="text-3xl font-bold text-gray-300">Sign In</h2>
            <div className="border-2 w-10 border-gray-300 mb-2" />
            <div className="flex justify-center space-x-2">
              <a href="#" className="border-2 border-gray-200 rounded-full p-3">
                <FaGoogle className="text-sm" />
              </a>
            </div>
            <p className="text-gray-300 text-center">
              or use your email account
            </p>

            <div className="flex flex-col items-center w-full">
              <div className="bg-gray-100 w-64 p-2 my-2 rounded-lg flex items-center">
                <FaRegEnvelope className="text-gray-500 m-2" />
                <input
                  type="email"
                  placeholder="Email"
                  name="email"
                  className="text-gray-800 bg-gray-100 text-sm flex-1 outline-none"
                />
              </div>
              <PasswordInput placeholder="Password" name="passwordSignIn" />
            </div>

            <div className="flex w-64 items-center text-xs">
              <label className="flex items-center">
                <input type="checkbox" name="remember" className="mr-1" />
                Remember me
              </label>
              <a href="#" className="ml-auto hover:underline">
                Forgot Password?
              </a>
            </div>

            <a
              href="#"
              className="
                inline-block
                border-2 border-white
                rounded-full
                px-6 py-2
                font-semibold
                text-white
                transform transition
                duration-300
                hover:scale-105
                hover:shadow-lg
                hover:text-[#7a16ee]
                hover:border-[#7a16ee]
              ">
              Sign In
            </a>
          </div>

          <SignUpSection isSignup={isSignup} />

          <div
            className={`
              absolute inset-y-0 right-0 w-1/2 bg-[#5B2A86]
              flex flex-col items-center justify-center space-y-6 p-8
              transition-transform duration-500 ease-in-out
              ${isSignup ? "-translate-x-full" : "translate-x-0"}
            `}>
            <img src="/logo_wtit.png" alt="Logo" className="h-20" />
            <p
              className="
                text-center
                text-white
                px-4
                whitespace-pre-line
              ">
              {isSignup
                ? "Already have an account?\nGo back to Sign In."
                : "Organize your finances quickly and effortlessly."}
            </p>

            <button
              onClick={() => setIsSignup((prev) => !prev)}
              className="
                px-8 py-2 rounded-full border-2
                border-white text-white font-semibold
                transition-transform duration-300 hover:scale-105
                hover:bg-white/10
              ">
              {isSignup ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
