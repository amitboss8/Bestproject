import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OTPService } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search } from "lucide-react";
import { Link } from "wouter";
import * as SiIcons from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

export default function GetOTP() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const { data: services, isLoading } = useQuery<OTPService[]>({
    queryKey: ["/api/otp-services"],
  });

  const { data: balance } = useQuery({
    queryKey: ["/api/balance"],
  });

  const filteredServices = services?.filter((service) =>
    service.name.toLowerCase().includes(search.toLowerCase())
  );

  const handlePurchase = (service: OTPService) => {
    if (parseFloat(balance?.balance || "0") < parseFloat(service.price)) {
      toast({
        title: "Insufficient balance",
        description: `Add more funds to purchase OTP for ${service.name}`,
        variant: "destructive",
      });
      return;
    }

    // Here you would implement the OTP purchase logic
    toast({
      title: "OTP Purchased",
      description: `Successfully purchased OTP for ${service.name}`,
    });
  };

  // Dynamic icon component from react-icons/si
  const getIconComponent = (iconName: string) => {
    const Icon = (SiIcons as any)[iconName];
    return Icon ? <Icon className="w-6 h-6" /> : null;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
      <div className="max-w-4xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <Card className="backdrop-blur-lg bg-white/10 border-none mb-4">
          <CardHeader>
            <CardTitle>Get OTP</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-4">Loading services...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices?.map((service) => (
              <Card
                key={service.id}
                className="backdrop-blur-lg bg-white/10 border-none hover:bg-white/20 transition"
              >
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      {getIconComponent(service.icon)}
                      <h3 className="font-semibold">{service.name}</h3>
                    </div>
                    <span className="text-lg font-bold">₹{service.price}</span>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => handlePurchase(service)}
                    disabled={
                      parseFloat(balance?.balance || "0") <
                      parseFloat(service.price)
                    }
                  >
                    Purchase OTP
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
