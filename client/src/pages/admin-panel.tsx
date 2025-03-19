import { useQuery, useMutation } from "@tanstack/react-query";
import { Transaction } from "@shared/schema";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, Wallet, Clock } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function AdminPanel() {
  const { toast } = useToast();

  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
  });

  const { data: pendingTransactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/admin/pending-transactions"],
  });

  const updateTransactionMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "approved" | "rejected" }) => {
      const res = await apiRequest("POST", `/api/admin/update-transaction/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({
        title: "Transaction updated",
        description: "The transaction status has been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="backdrop-blur-lg bg-white/10 border-none">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Users className="w-5 h-5 mr-2" />
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats?.totalUsers || 0}</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-lg bg-white/10 border-none">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Wallet className="w-5 h-5 mr-2" />
                Total Deposits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">₹{stats?.totalDeposits || "0"}</p>
            </CardContent>
          </Card>

          <Card className="backdrop-blur-lg bg-white/10 border-none">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Today's Deposits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">₹{stats?.todayDeposits || "0"}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="backdrop-blur-lg bg-white/10 border-none">
          <CardHeader>
            <CardTitle>Pending Balance Requests</CardTitle>
            <CardDescription className="text-gray-300">
              Approve or reject user balance requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4">Loading transactions...</div>
            ) : pendingTransactions?.length === 0 ? (
              <div className="text-center py-4">No pending transactions</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>UTR Number</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTransactions?.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {format(
                          new Date(transaction.createdAt),
                          "MMM d, yyyy HH:mm"
                        )}
                      </TableCell>
                      <TableCell>{transaction.username}</TableCell>
                      <TableCell>{transaction.utrNumber}</TableCell>
                      <TableCell>₹{transaction.amount}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() =>
                              updateTransactionMutation.mutate({
                                id: transaction.id,
                                status: "approved",
                              })
                            }
                            disabled={updateTransactionMutation.isPending}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              updateTransactionMutation.mutate({
                                id: transaction.id,
                                status: "rejected",
                              })
                            }
                            disabled={updateTransactionMutation.isPending}
                          >
                            Reject
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
