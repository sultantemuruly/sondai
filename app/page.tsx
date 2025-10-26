import { Button } from "@/components/ui/button";
import {
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import {
  BookOpen,
  FolderPlus,
  BrainCircuit,
  Shield,
  Zap,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Lightbulb,
  Users,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="container mx-auto flex justify-between items-center px-6 h-16">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Sondai
            </span>
          </div>
          
          <SignedOut>
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  Start Now
                </Button>
              </Link>
            </div>
          </SignedOut>
          <SignedIn>
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
                  Go to Dashboard
                </Button>
              </Link>
              <UserButton />
            </div>
          </SignedIn>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-100/50">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700">
                AI-Powered Study Assistant
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight">
              <span className="block bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Study Smarter,
              </span>
              <span className="block text-gray-900">
                Not Harder
              </span>
            </h1>

            {/* Description */}
            <p className="text-xl md:text-2xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Transform your learning with AI-powered study tools. Organize, review, and master any subject faster.
            </p>

            {/* CTA Buttons */}
            <SignedOut>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link href="/dashboard">
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 h-14 shadow-lg hover:shadow-xl transition-all"
                  >
                    Start Learning Free
                    <ArrowRight className="ml-2" />
                  </Button>
                </Link>
              </div>
            </SignedOut>
            <SignedIn>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link href="/dashboard">
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 h-14 shadow-lg hover:shadow-xl transition-all"
                  >
                    Go to Dashboard
                    <ArrowRight className="ml-2" />
                  </Button>
                </Link>
              </div>
            </SignedIn>

            {/* Trust Indicators */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 pt-12 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                <span>Free Forever</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-500" />
                <span>No Credit Card</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <span>Data Privacy</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-white">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Everything You Need to Ace Your Studies
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Powerful features designed to help you study more effectively and achieve better results.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mb-6 group-hover:scale-110 transition-transform">
                <FolderPlus className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Smart Organization
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Create and organize your study materials into folders. Never lose track of your notes again.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 mb-6 group-hover:scale-110 transition-transform">
                <BrainCircuit className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                AI-Powered Learning
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Leverage cutting-edge AI to enhance your study sessions with personalized insights and recommendations.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-pink-300 hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-pink-500 to-pink-600 mb-6 group-hover:scale-110 transition-transform">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Comprehensive Notes
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Build detailed study notes and keep everything in one accessible place across all devices.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-cyan-600 mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Quick Access
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Fast and intuitive interface that gets you to your materials instantly when you need them most.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-green-300 hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 mb-6 group-hover:scale-110 transition-transform">
                <Lightbulb className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Study Insights
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Get personalized recommendations and insights to optimize your study strategy and improve retention.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="group p-8 rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-xl transition-all bg-gradient-to-br from-white to-gray-50">
              <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 mb-6 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Seamless Sync
              </h3>
              <p className="text-gray-600 leading-relaxed">
                Access your study materials anywhere, anytime. All your data syncs across devices instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-6">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold text-white">Sondai</span>
            </div>
            <p className="text-sm">
              © 2025 Sondai. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
