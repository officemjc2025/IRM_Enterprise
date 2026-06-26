"use client";

import Image from "next/image";

type LogoProps = {
  type?: "irm" | "metro";
  width?: number;
  height?: number;
};

export default function Logo({
  type = "irm",
  width = 120,
  height = 120,
}: LogoProps) {
  const src =
    type === "irm"
      ? "/branding/irm/logo.png"
      : "/branding/metro/logo.png";

  const alt =
    type === "irm"
      ? "IRM Enterprise"
      : "Metro Jomtien Condotel";

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      priority
      className="object-contain"
    />
  );
}