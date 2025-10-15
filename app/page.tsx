import { Button } from "@/components/ui/button";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export default function Home() {
  return (
    <div>
      <header className="flex justify-end items-center p-4 gap-4 h-16">
        <SignedOut>
          <SignInButton>
            <Button variant={"ghost"}>Sign In</Button>
          </SignInButton>
          <SignUpButton>
            <Button variant={"ghost"}>Sign Up</Button>
          </SignUpButton>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </header>
    </div>
  );
}
