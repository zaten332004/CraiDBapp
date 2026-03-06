'use client';

import { Navigation } from "@/components/navigation";
import { HeroSection } from "@/components/hero-section";
import { ProblemSolutionSection } from "@/components/problem-solution-section";
import { ArchitectureSection } from "@/components/architecture-section";
import { FeaturesSection } from "@/components/features-section";
import { TechnologySection } from "@/components/technology-section";
import { DemoSection } from "@/components/demo-section";
import { UseCasesSection } from "@/components/use-cases-section";
import { AboutSection } from "@/components/about-section";
import { Footer } from "@/components/footer";
import { ScrollReveal } from "@/components/scroll-reveal";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navigation />
      <ScrollReveal delayMs={0}><HeroSection /></ScrollReveal>
      <ScrollReveal delayMs={60}><ProblemSolutionSection /></ScrollReveal>
      <ScrollReveal delayMs={80}><ArchitectureSection /></ScrollReveal>
      <ScrollReveal delayMs={100}><FeaturesSection /></ScrollReveal>
      <ScrollReveal delayMs={120}><TechnologySection /></ScrollReveal>
      <ScrollReveal delayMs={140}><DemoSection /></ScrollReveal>
      <ScrollReveal delayMs={160}><UseCasesSection /></ScrollReveal>
      <ScrollReveal delayMs={180}><AboutSection /></ScrollReveal>
      <ScrollReveal delayMs={200}><Footer /></ScrollReveal>
    </main>
  );
}
