import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Wallet,
  CreditCard,
  History,
  MessageSquareCode,
  HelpCircle,
  LogOut,
  Users,
  Copy,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  const { data: balance } = useQuery({
    queryKey: ["/api/balance"],
  });

  const { data: referralStats } = useQuery({
    queryKey: ["/api/referral-stats"],
  });

  const handleNeedHelp = () => {
    if (parseFloat(balance?.balance || "0") < 100) {
      toast({
        title: "Account balance too low",
        description: "Please add ₹100 to your wallet to access support",
        variant: "destructive",
      });
    }
  };

  const copyReferralCode = () => {
    if (user?.referCode) {
      navigator.clipboard.writeText(user.referCode);
      toast({
        title: "Referral code copied",
        description: "Share it with your friends to earn rewards!",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Welcome, {user?.username}</h1>
          <div className="flex gap-2">
            {user?.username === "noobru" && (
              <Button variant="outline" asChild>
                <Link href="/admin">
                  Admin Panel
                </Link>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => logoutMutation.mutate()}
              disabled={logoutMutation.isPending}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="backdrop-blur-lg bg-white/10 border-none">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wallet className="w-5 h-5 mr-2" />
                Wallet Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">₹{balance?.balance || "0"}</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-lg bg-white/10 border-none">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                My Referral Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <code className="bg-white/20 px-3 py-1 rounded">{user?.referCode}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyReferralCode}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              {referralStats && (
                <div className="mt-4 space-y-2 text-sm">
                  <p>Total Invites: {referralStats.totalInvites}</p>
                  <p>Successful Referrals: {referralStats.successfulReferrals}</p>
                  <p>Total Earned: ₹{referralStats.totalEarned}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Link href="/add-balance">
            <Card className="backdrop-blur-lg bg-white/10 border-none cursor-pointer hover:bg-white/20 transition">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <CreditCard className="w-5 h-5 mr-2" />
                  Add Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-300">
                  Add money to your wallet
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/get-otp">
            <Card className="backdrop-blur-lg bg-white/10 border-none cursor-pointer hover:bg-white/20 transition">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <MessageSquareCode className="w-5 h-5 mr-2" />
                  Get OTP
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-300">
                  Purchase OTP services
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Card
            className={`backdrop-blur-lg bg-white/10 border-none cursor-pointer hover:bg-white/20 transition ${
              parseFloat(balance?.balance || "0") < 100 ? "opacity-50" : ""
            }`}
            onClick={handleNeedHelp}
          >
            <CardHeader>
              <CardTitle className="flex items-center">
                <HelpCircle className="w-5 h-5 mr-2" />
                Need Help
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-gray-300">
                24/7 Customer Support
              </CardDescription>
            </CardContent>
          </Card>

          <Link href="/transactions">
            <Card className="backdrop-blur-lg bg-white/10 border-none cursor-pointer hover:bg-white/20 transition">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <History className="w-5 h-5 mr-2" />
                  Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-300">
                  View your transactions
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}