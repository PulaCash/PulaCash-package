/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  presets: [require("nativewind/preset")],
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        pula: {
          ink: "#071532",
          blue: "#075DFF",
          cyan: "#32D5F4",
          mist: "#F1F6FF",
          line: "#DDE8FA",
          muted: "#758096",
          success: "#12B981",
          successSoft: "#EAFBF4"
        }
      },
      borderRadius: {
        "4xl": "32px"
      }
    }
  },
  plugins: []
};
