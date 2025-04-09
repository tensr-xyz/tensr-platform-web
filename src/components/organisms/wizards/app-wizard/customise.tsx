import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select';
import { useTheme } from '@/contexts/theme-context';

export default function Customise() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-8">
      <h1 className="font-semibold mb-4">Appearance</h1>
      <div className="flex items-center gap-4">
        <div className="text-sm">Theme:</div>
        <Select onValueChange={setTheme} defaultValue={theme}>
          <SelectTrigger className="w-[180px] h-8">
            <SelectValue placeholder="Select a theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
