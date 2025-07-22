export default function Footer() {
  return (
    <footer className="absolute bottom-0 left-0 z-10 w-full py-4 text-center text-white/70 text-sm">
      © {new Date().getFullYear()} MoneyMap. All rights reserved.
    </footer>
  );
}
