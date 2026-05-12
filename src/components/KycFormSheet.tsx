import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSubmitKyc } from "@/hooks/use-kyc";

const ID_TYPE_LABELS: Record<string, string> = {
  ID_CARD: "身份证",
  PASSPORT: "护照",
  DRIVER_LICENSE: "驾照",
};

interface KycFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KycFormSheet({ open, onOpenChange }: KycFormSheetProps) {
  const [realName, setRealName] = useState("");
  const [idType, setIdType] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [country, setCountry] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const submitMutation = useSubmitKyc();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const frontFile = frontRef.current?.files?.[0];
    if (!frontFile) {
      toast.error("请上传证件正面照片");
      return;
    }
    if (!idType) {
      toast.error("请选择证件类型");
      return;
    }

    const formData = new FormData();
    formData.append("realName", realName.trim());
    formData.append("idType", idType);
    formData.append("idNumber", idNumber.trim());
    formData.append("country", country.trim());
    formData.append("birthDate", birthDate);
    formData.append("frontImage", frontFile);
    const backFile = backRef.current?.files?.[0];
    if (backFile) formData.append("backImage", backFile);

    submitMutation.mutate(formData, {
      onSuccess: () => {
        toast.success("KYC 认证已提交，请等待审核");
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : "提交失败，请重试");
      },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>提交 KYC 认证</SheetTitle>
          <SheetDescription>请填写真实信息并上传有效证件照片，审核通常在 1-3 个工作日内完成。</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="realName">真实姓名</Label>
            <Input
              id="realName"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              placeholder="请输入真实姓名"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>证件类型</Label>
            <Select value={idType} onValueChange={setIdType} required>
              <SelectTrigger>
                <SelectValue placeholder="请选择证件类型" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ID_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="idNumber">证件号码</Label>
            <Input
              id="idNumber"
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="请输入证件号码"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">国家/地区</Label>
            <Input
              id="country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="例如：中国"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthDate">出生日期</Label>
            <Input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="frontImage">证件正面照片（必填）</Label>
            <Input id="frontImage" type="file" accept="image/*" ref={frontRef} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="backImage">证件背面照片（可选）</Label>
            <Input id="backImage" type="file" accept="image/*" ref={backRef} />
          </div>

          <Button type="submit" className="w-full" disabled={submitMutation.isPending}>
            {submitMutation.isPending ? "提交中..." : "提交认证"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
