import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTransactionSchema } from "@shared/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy } from "lucide-react";
import { Link } from "wouter";

const UPI_ID = "Amitachara@fam";
const MIN_AMOUNT = 100;

export default function AddBalance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const form = useForm({
    resolver: zodResolver(
      insertTransactionSchema.extend({
        amount: insertTransactionSchema.shape.amount.refine(
          (val) => parseFloat(val) >= MIN_AMOUNT,
          { message: `Minimum amount is ₹${MIN_AMOUNT}` }
        ),
      })
    ),
    defaultValues: {
      amount: "",
      utrNumber: "",
    },
  });

  const addBalanceMutation = useMutation({
    mutationFn: async (data: { amount: string; utrNumber: string }) => {
      const res = await apiRequest("POST", "/api/balance", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/balance"] });
      toast({
        title: "Transaction submitted",
        description: "Your balance will be updated after verification",
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to add balance",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyUpiId = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "UPI ID copied",
      description: "Paste it in your payment app",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
      <div className="max-w-xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <Card className="backdrop-blur-lg bg-white/10 border-none">
          <CardHeader>
            <CardTitle>Add Balance</CardTitle>
            <CardDescription className="text-gray-300">
              Minimum amount: ₹{MIN_AMOUNT}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-center space-y-4">
              <img
                src="https://chart.googleapis.com/chart?cht=qr&chl=upi://pay?pa=Amitachara@fam&pn=OTP%20Service&amt=100&cu=INR&chs=300x300"
                alt="Payment QR Code"
                className="w-64 h-64"
              />
              <div className="flex items-center space-x-2">
                <code className="bg-white/20 px-3 py-1 rounded">{UPI_ID}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyUpiId}
                  className={copied ? "text-green-500" : ""}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit((data) =>
                  addBalanceMutation.mutate(data)
                )}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount (₹)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          min={MIN_AMOUNT}
                          step="0.01"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="utrNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>UTR Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Enter UTR number"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  className="w-full"
                  disabled={addBalanceMutation.isPending}
                >
                  Submit Payment
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
