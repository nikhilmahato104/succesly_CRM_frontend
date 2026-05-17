
// import React from "react";
// import loginImage from "../assets/images/auth_bg_dark.png";
// import SucceslyLogo from "../assets/images/Succesly2.png";

// interface AuthLayoutProps {
//   children: React.ReactNode;
// }

// export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
//   return (
//     <div style={{ minHeight: "100vh", width: "100%", display: "flex" }}>

//       {/* ── Left: full-bleed photo panel (desktop only) ─────────────────── */}
//       <div className="hidden lg:block lg:flex-1 relative overflow-hidden">
//         <img
//           src={loginImage}
//           alt="background"
//           className="absolute inset-0 w-full h-full object-cover object-center"
//         />
//         <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
//       </div>

//       {/* ── Right: dark panel ────────────────────────────────────────────── */}
//       <div
//         style={{
//           width: "100%",
//           // backgroundColor: "#17171a",
//           backgroundColor:"black",
//           display: "flex",
//           flexDirection: "column",
//           alignItems: "center",
//           justifyContent: "space-between",
//           padding: "0 24px",
//           flexShrink: 0,
//         }}
//         className="lg:w-[440px] xl:w-[480px]"
//       >
//         {/* Top spacer */}
//         <div style={{ flex: 1 }} />

//         {/* Content column */}
//         <div style={{ width: "100%", maxWidth: 390 }}>

//           {/* Logo */}
//           {/* <div style={{ display: "flex", justifyContent: "center", marginBottom: "52px" }}>
//             <img
//               src={SucceslyLogo}
//               alt="Succesly"
//               style={{
//                 height: "44px",
//                 width: "auto",
//                 objectFit: "contain",
//               }}
//             />
//           </div> */}
//           <div style={{ display: "flex", justifyContent: "center", marginBottom: "52px" }}>
//   <img
//     src={SucceslyLogo}
//     alt="Succesly"
//     style={{
//       height: "80px",
//       width: "auto",
//       objectFit: "contain",
//     }}
//   />
// </div>

//           {/* Form slot */}
//           {children}
//         </div>

//         {/* Bottom spacer */}
//         <div style={{ flex: 1 }} />

//         {/* Footer */}
//         <p style={{
//           color: "rgba(255,255,255,0.22)",
//           fontSize: "12px",
//           paddingBottom: "24px",
//           textAlign: "center",
//         }}>
//           © 2026 Succesly · Contact us
//         </p>
//       </div>
//     </div>
//   );
// };





//v2
import React from "react";
// import loginImage from "../assets/images/auth_bg_dark.png";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div
      style={{
        height: "100dvh", // dvh = dynamic viewport height, fixes mobile browser bars
        width: "100%",
        display: "flex",
        overflow: "hidden", // no scroll ever
      }}
    >
      {/* ── Left: full-bleed photo panel (desktop only) ─────────────────── */}
      <div className="hidden lg:block lg:flex-1 relative overflow-hidden">
        <img
          // src={loginImage}
          alt="background"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
      </div>

      {/* ── Right: dark panel ────────────────────────────────────────────── */}
      <div
        style={{
          width: "100%",
          backgroundColor: "#000",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          flexShrink: 0,
          height: "100%",
          overflow: "hidden",
        }}
        className="lg:w-[440px] xl:w-[480px]"
      >
        {/* Content column — vertically centred between top & footer */}
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
          }}
        >
          <div style={{ width: "100%", maxWidth: 360 }}>

            {/* Brand name using global font */}
            <div style={{ textAlign: "center", marginBottom: "32px" }}>
              <span
                style={{
                  fontSize: "26px",
                  fontWeight: 700,
                  color: "#fff",
                  letterSpacing: "-0.5px",
                  fontFamily: "inherit", // uses whatever global font is set
                }}
              >
                Succesly
              </span>
            </div>

            {/* Form slot */}
            {children}
          </div>
        </div>

        {/* Footer — always pinned at bottom, never scrolled away */}
        <p
          style={{
            color: "rgba(255,255,255,0.22)",
            fontSize: "12px",
            paddingBottom: "16px",
            paddingTop: "12px",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          © 2026 Succesly · Contact us
        </p>
      </div>
    </div>
  );
};