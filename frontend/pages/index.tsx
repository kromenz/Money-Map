"use client";
import { useState } from "react";
import Footer from "../src/components/Footer";
import DarkVeil from "../styles/DarkVeil/DarkVeil";
import { FaGoogle, FaRegEnvelope } from "react-icons/fa";
import PasswordInput from "../utils/PassInput";
import SignUpSection from "../src/components/SignUp";
import { toast } from "sonner";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuthContext } from "../src/context/AuthContext";
import * as authService from "../src/services/auth.service";

export default function Home() {
  const router = useRouter();
  const [isSignup, setIsSignup] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingSignIn, setLoadingSignIn] = useState(false);

  const [loadingSignUp, setLoadingSignUp] = useState(false);

  const { login, user, loading } = useAuthContext();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  async function handleSignIn(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email || !password)
      return toast.error("Fill in the email and password");

    try {
      const res = await login({ email, password });
      if (res?.user) {
        toast.success("Welcome!");
        router.push("/dashboard");
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.message || "Login failed");
    }
  }

  async function handleSignUp(payload: {
    name?: string;
    email: string;
    password: string;
  }) {
    setLoadingSignUp(true);
    try {
      const res = await authService.register(payload);
      // se o backend retornar user ou ok, podes reagir aqui
      toast.success("Conta criada com sucesso");

      // opcional: se quiseres fazer login automático depois do register,
      // podes chamar authService.login(...) aqui e redirecionar
      // const loginRes = await authService.login({ email: payload.email, password: payload.password });

      setIsSignup(false);

      // opcional: redireciona para dashboard
      // router.push("/dashboard");
    } catch (err: any) {
      console.error("SignUp error:", err);
      const msg =
        err?.response?.data?.error || err?.message || "Registo falhou";
      toast.error(msg);
      throw err; // opcional: rethrow se queres que o caller também reaja
    } finally {
      setLoadingSignUp(false);
    }
  }

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

            <form
              className="flex flex-col items-center w-full"
              onSubmit={handleSignIn}>
              <div className="bg-gray-100 w-64 p-2 my-2 rounded-lg flex items-center">
                <FaRegEnvelope className="text-gray-500 m-2" />
                <input
                  type="email"
                  placeholder="Email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-gray-800 bg-gray-100 text-sm flex-1 outline-none"
                />
              </div>

              <PasswordInput
                placeholder="Password"
                name="passwordSignIn"
                value={password}
                onChange={(e) =>
                  setPassword((e.target as HTMLInputElement).value)
                }
              />

              <div className="flex w-64 items-center text-xs mt-2">
                <a href="#" className="ml-auto hover:underline">
                  Forgot Password?
                </a>
              </div>

              <button
                type="submit"
                disabled={loadingSignIn}
                className={`inline-block border-2 border-white rounded-full px-6 py-2 font-semibold text-white transform transition duration-300 hover:scale-105 hover:shadow-lg ${
                  loadingSignIn
                    ? "opacity-60 cursor-not-allowed"
                    : "hover:text-[#7a16ee] hover:border-[#7a16ee]"
                } mt-4`}>
                {loadingSignIn ? "Signing in..." : "Sign In"}
              </button>
            </form>
          </div>

          <SignUpSection
            isSignup={isSignup}
            onSignUp={handleSignUp}
            loading={loadingSignUp}
          />

          <div
            className={`absolute inset-y-0 right-0 w-1/2 bg-[#5B2A86] flex flex-col items-center justify-center space-y-6 p-8 transition-transform duration-500 ease-in-out ${
              isSignup ? "-translate-x-full" : "translate-x-0"
            }`}>
            <img src="/logo_wtit.png" alt="Logo" className="h-20" />
            <p className="text-center text-white px-4 whitespace-pre-line">
              {isSignup
                ? "Already have an account?\nGo back to Sign In."
                : "Organize your finances quickly and effortlessly."}
            </p>

            <button
              onClick={() => setIsSignup((prev) => !prev)}
              className="px-8 py-2 rounded-full border-2 border-white text-white font-semibold transition-transform duration-300 hover:scale-105 hover:bg-white/10">
              {isSignup ? "Sign In" : "Sign Up"}
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
