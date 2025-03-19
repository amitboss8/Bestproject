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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();
  
  const { data: balance } = useQuery({
    queryKey: ["/api/balance"],
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Welcome, {user?.username}</h1>
          <Button
            variant="outline"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
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
