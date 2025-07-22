import Footer from "../components/Footer";
import DarkVeil from "../styles/DarkVeil/DarkVeil";
import { FaGoogle, FaRegEnvelope } from "react-icons/fa";
import { MdLockOutline } from "react-icons/md";

export default function Home() {
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

      <div className="relative z-20 flex flex-1 items-center justify-center w-full px-20 h-full">
        <div
          className="flex w-full md:w-4/5 lg:w-3/5 h-[60vh] bg-white/20 backdrop-blur-lg border border-white/30 
          rounded-2xl shadow-2xl overflow-hidden">
          <div className="w-3/5 flex-1 flex flex-col items-center justify-center p-5 text-white">
            <div className="flex flex-col items-center space-y-4">
              <h2 className="text-3xl font-bold text-gray-300">Sign In</h2>
              <div className="border-2 w-10 border-gray-300 mb-2" />
              <div className="flex justify-center space-x-2">
                <a
                  href="#"
                  className="border-2 border-gray-200 rounded-full p-3">
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
                <div className="bg-gray-100 w-64 p-2 my-2 rounded-lg flex items-center">
                  <MdLockOutline className="text-gray-500 m-2" />
                  <input
                    type="password"
                    placeholder="Password"
                    name="password"
                    className="text-gray-800 bg-gray-100 text-sm flex-1 outline-none"
                  />
                </div>
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
                border-2 border-[#7a16ee]
                rounded-full
                px-6 py-2
                font-semibold
                text-[#7a16ee]
                transform transition
                duration-300
                hover:scale-105
                hover:shadow-lg
                hover:bg-white/10
                hover:text-gray-100
                hover:border-white
              ">
                Sign In
              </a>
            </div>
          </div>

          <div className="w-2/5 flex-1 flex flex-col items-center justify-center bg-[#7a16ee] text-white rounded-tr-2xl rounded-br-2xl p-8 space-y-4">
            <h2 className="text-3xl font-bold">
              <img src="/logo_wtit.png" alt="Logo" className="w-auto h-20" />
            </h2>
            <div className="border-2 w-10 border-white" />
            <p className="text-center">
              Organize your finances quickly and effortlessly.
            </p>
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
                hover:bg-white/10
                hover:text-gray-100
              ">
              Sign Up
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
