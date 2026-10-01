import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Home from "@/pages/Home";
import Embed from "@/pages/Embed";
import Ask from "@/pages/Ask";
import Wap from "@/pages/Wap";
import { isMobileDevice } from "@/lib/utils";

/**
 * 设备分流：移动设备访问主页自动跳转 /wap（专属 WAP 界面），
 * 桌面设备访问 /wap 自动回到主页。URL 带 ?force 参数时跳过分流，便于调试预览。
 */
function DeviceGate() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (new URLSearchParams(location.search).has('force')) return;
    const mobile = isMobileDevice();
    if (mobile && location.pathname === '/') {
      navigate('/wap', { replace: true });
    } else if (!mobile && location.pathname === '/wap') {
      navigate('/', { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}

export default function App() {
  return (
    <Router>
      <DeviceGate />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/wap" element={<Wap />} />
        <Route path="/embed" element={<Embed />} />
        <Route path="/ask" element={<Ask />} />
        <Route path="/other" element={<div className="text-center text-xl">Other Page - Coming Soon</div>} />
      </Routes>
    </Router>
  );
}
