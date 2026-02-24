import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  FlaskConical, 
  Package, 
  MapPin,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Lock,
  User,
  Hash,
  FileText,
  X,
  AlertCircle,
  Minus,
  Plus,
  Clock,
  ShieldCheck,
  LogOut,
  Download,
  Eye
} from 'lucide-react';
import { toast } from 'sonner';
import { isBefore, addDays } from 'date-fns';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatLocation } from '../components/inventory/ItemsTable';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import debounce from 'lodash/debounce';
import { invokeEdgeFunction } from '@/lib/edgeClient';
import MsdsViewerModal from '@/components/msds/MsdsViewerModal';
import { getSignedMsdsUrl } from '@/services/msdsService';

const SESSION_KEY = 'lab_student_session';
const SESSION_DURATION = 4 * 60 * 60 * 1000; // 4 hours
const RECENT_ITEMS_KEY = 'lab_recent_items';
const MAX_RECENT_ITEMS = 5;

export default function StudentUse() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);

  // Item search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [recentItems, setRecentItems] = useState([]);
  const [allItems, setAllItems] = useState([]);

  // Usage form state
  const [studentName, setStudentName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [experiment, setExperiment] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [deductMode, setDeductMode] = useState('CONTENT');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [msdsViewerOpen, setMsdsViewerOpen] = useState(false);
  const [msdsViewerUrl, setMsdsViewerUrl] = useState(null);
  const [msdsViewerTitle, setMsdsViewerTitle] = useState('MSDS Viewer');
  const [loadingMsdsViewId, setLoadingMsdsViewId] = useState(null);
  const [loadingMsdsDownloadId, setLoadingMsdsDownloadId] = useState(null);

  const searchInputRef = useRef(null);
  const pinSpores = useMemo(
    () =>
      Array.from({ length: 32 }, () => ({
        left: `${Math.random() * 100}%`,
        bottom: `${Math.random() * 15 - 5}px`,
        size: `${2 + Math.random() * 5}px`,
        color: Math.random() > 0.5 ? 'rgba(201,168,76,0.75)' : 'rgba(64,145,108,0.75)',
        delay: `${Math.random() * 16}s`,
        duration: `${12 + Math.random() * 10}s`,
      })),
    []
  );

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      const stored = localStorage.getItem(RECENT_ITEMS_KEY);
      if (stored) {
        try {
          setRecentItems(JSON.parse(stored));
        } catch (e) {
          console.error('Error parsing recent items:', e);
        }
      }
      loadAllItems();
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isAuthenticated]);

  const loadAllItems = async () => {
    try {
      const res = await invokeEdgeFunction('student-items', {}, { requireAuth: false });
      const items = res?.items || [];
      setAllItems(items);
    } catch (error) {
      console.error('Error loading items:', error);
    }
  };

  const saveRecentItem = (item) => {
    const updated = [item, ...recentItems.filter((r) => r.id !== item.id)].slice(0, MAX_RECENT_ITEMS);
    setRecentItems(updated);
    localStorage.setItem(RECENT_ITEMS_KEY, JSON.stringify(updated));
  };

  const clearRecentItems = () => {
    setRecentItems([]);
    localStorage.removeItem(RECENT_ITEMS_KEY);
    toast.success('Recently used items cleared');
  };

  const checkSession = async () => {
    try {
      const session = localStorage.getItem(SESSION_KEY);
      if (session) {
        const { expiry, verified } = JSON.parse(session);
        if (verified && new Date().getTime() < expiry) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setIsCheckingSession(false);
    }
  };

  const verifyPin = async () => {
    setPinError('');
    setIsVerifying(true);

    try {
      const result = await invokeEdgeFunction('verify-pin', { pin: pinInput }, { requireAuth: false });
      if (result?.valid) {
        const session = {
          verified: true,
          expiry: new Date().getTime() + SESSION_DURATION,
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        setIsAuthenticated(true);
        toast.success('Access granted');
      } else {
        setPinError('Incorrect PIN. Please try again.');
      }
    } catch (error) {
      setPinError(error.message || 'Failed to verify PIN. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const searchItems = useCallback(
    debounce((query) => {
      if (!query.trim()) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      const q = query.toLowerCase();
      const filtered = allItems.filter((item) => item.name.toLowerCase().includes(q) || item.location?.toLowerCase().includes(q));
      setSearchResults(filtered.slice(0, 15));
      setIsSearching(false);
    }, 300),
    [allItems]
  );

  useEffect(() => {
    if (searchQuery) {
      setIsSearching(true);
    }
    searchItems(searchQuery);
  }, [searchQuery, searchItems]);

  const selectItem = (item) => {
    invokeEdgeFunction('student-items', { item_id: item.id }, { requireAuth: false })
      .then((res) => {
        const latest = Array.isArray(res?.items) && res.items.length > 0 ? res.items[0] : item;
        setSelectedItem(latest);
        const trackingType = latest?.tracking_type || 'SIMPLE_MEASURE';
        setDeductMode(trackingType === 'PACK_WITH_CONTENT' ? 'CONTENT' : 'UNITS');
        saveRecentItem(latest);
      })
      .catch(() => {
        setSelectedItem(item);
        const trackingType = item?.tracking_type || 'SIMPLE_MEASURE';
        setDeductMode(trackingType === 'PACK_WITH_CONTENT' ? 'CONTENT' : 'UNITS');
        saveRecentItem(item);
      });

    setSearchQuery('');
    setSearchResults([]);
    setQuantity(1);
    setFormError('');
  };

  const closeSheet = () => {
    setSelectedItem(null);
    setQuantity(1);
    setDeductMode('CONTENT');
    setNotes('');
    setFormError('');
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const resetStudentSession = (message) => {
    localStorage.removeItem(SESSION_KEY);
    setIsAuthenticated(false);
    setSelectedItem(null);
    setSearchQuery('');
    setSearchResults([]);
    setPinInput('');
    setFormError('');
    setPinError(message || 'Session expired. Please enter your PIN again.');
  };

  const handleEndSession = () => {
    resetStudentSession('Session ended. Please enter your PIN again.');
    toast.success('Session ended');
  };

  const isInvalidPinError = (errorMessage = '') => {
    const msg = errorMessage.toLowerCase();
    return msg.includes('invalid pin') || msg.includes('pin format') || msg.includes('pin required');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!studentName.trim()) {
      setFormError('Your name is required');
      return;
    }

    const trackingType = selectedItem?.tracking_type || 'SIMPLE_MEASURE';
    const stockValue = getAvailableForMode(selectedItem, deductMode);
    const currentUnit = getUnitForMode(selectedItem, deductMode);

    if (quantity <= 0) {
      setFormError('Quantity must be greater than 0');
      return;
    }

    if (trackingType !== 'SIMPLE_MEASURE' && !Number.isInteger(quantity)) {
      setFormError('Quantity must be a whole number for this item type');
      return;
    }

    if (quantity > stockValue) {
      setFormError(`Insufficient stock. Available: ${stockValue} ${currentUnit}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await invokeEdgeFunction(
        'student-use-item',
        {
          pin: pinInput,
          item_id: selectedItem.id,
          quantity,
          deduct_mode: deductMode,
          student_name: studentName.trim(),
          student_id: studentId.trim() || null,
          experiment: experiment.trim() || null,
          notes: notes.trim() || null,
        },
        { requireAuth: false, headers: { 'x-idempotency-key': `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` } }
      );

      toast.success(`Recorded: ${quantity} ${currentUnit} of ${selectedItem.name}`);

      const updatedItem = selectedItem.tracking_type === 'SIMPLE_MEASURE'
        ? { ...selectedItem, quantity_value: (selectedItem.quantity_value ?? selectedItem.quantity ?? 0) - quantity }
        : selectedItem.tracking_type === 'PACK_WITH_CONTENT' && deductMode === 'CONTENT'
          ? { ...selectedItem, total_content: (selectedItem.total_content ?? 0) - quantity }
          : { ...selectedItem, total_units: (selectedItem.total_units ?? selectedItem.quantity ?? 0) - quantity };
      saveRecentItem(updatedItem);

      closeSheet();
    } catch (error) {
      const message = error?.message || 'Failed to record usage';
      if (isInvalidPinError(message)) {
        resetStudentSession('Invalid or expired PIN. Please enter your PIN again.');
        return;
      }
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };
const getItemStatus = (item) => {
    const statuses = [];
    const stockForStatus = getAvailableForMode(item, 'UNITS');
    
    if (item.status === 'disposed') {
      return [{ label: 'DISPOSED', color: 'bg-red-100 text-red-700 border-red-200' }];
    }
    
    if (stockForStatus <= item.minimum_stock) {
      statuses.push({ label: 'Low Stock', color: 'bg-amber-100 text-amber-700 border-amber-200' });
    }
    
    if (item.expiration_date) {
      const expDate = new Date(item.expiration_date);
      if (isBefore(expDate, new Date())) {
        statuses.push({ label: 'Expired', color: 'bg-red-100 text-red-700 border-red-200' });
      } else if (isBefore(expDate, addDays(new Date(), 30))) {
        statuses.push({ label: 'Expiring Soon', color: 'bg-amber-100 text-amber-700 border-amber-200' });
      }
    }
    
    return statuses;
  };

  const getQuickButtons = (unit) => {
    const u = unit?.toLowerCase() || '';
    if (
      u === 'pcs' || u === 'pieces' || u === 'pc' || u === 'units' || u === 'unit' ||
      u.includes('bag') || u.includes('pack') || u.includes('box') || u.includes('bottle') || u.includes('kit')
    ) {
      return [1, 5, 10];
    }
    return [10, 50, 100];
  };

  const getTrackingType = (item) => item?.tracking_type || 'SIMPLE_MEASURE';

  const getAvailableForMode = (item, mode) => {
    const trackingType = getTrackingType(item);
    if (trackingType === 'SIMPLE_MEASURE') return Number(item?.quantity_value ?? item?.quantity ?? 0);
    if (trackingType === 'UNIT_ONLY') return Number(item?.total_units ?? item?.quantity ?? 0);
    if (mode === 'UNITS') return Number(item?.sealed_count ?? 0);
    return Number(item?.total_content ?? 0);
  };

  const getUnitForMode = (item, mode) => {
    const trackingType = getTrackingType(item);
    if (trackingType === 'SIMPLE_MEASURE') return item?.quantity_unit || item?.unit || '';
    if (trackingType === 'UNIT_ONLY') return item?.unit_type || item?.unit || 'unit';
    if (mode === 'UNITS') return item?.unit_type || item?.unit || 'pack';
    return item?.content_label || 'pcs';
  };

  const adjustQuantity = (delta) => {
    const newVal = Math.max(0, quantity + delta);
    const maxAvailable = getAvailableForMode(selectedItem, deductMode);
    if (selectedItem && newVal <= maxAvailable) {
      setQuantity(newVal);
    } else if (selectedItem) {
      setQuantity(maxAvailable);
    }
  };

  const supportsMsds = (item) => item?.category === 'chemical' || Boolean(item?.msds_current_id);
  const hasMsds = (item) => Boolean(item?.msds_current_id);

  const handleViewMsds = async (item) => {
    if (!supportsMsds(item) || !hasMsds(item)) {
      toast.error('No MSDS attached');
      return;
    }

    setLoadingMsdsViewId(item.id);
    try {
      const signedUrl = await getSignedMsdsUrl(item.msds_current_id, 'view', { pin: pinInput || null });
      if (!signedUrl) throw new Error('Missing signed URL');
      setMsdsViewerTitle(`${item.name} - MSDS`);
      setMsdsViewerUrl(signedUrl);
      setMsdsViewerOpen(true);
    } catch (error) {
      console.error('MSDS view error:', error);
      toast.error('Unable to open MSDS. Please try again.');
    } finally {
      setLoadingMsdsViewId(null);
    }
  };

  const handleDownloadMsds = async (item) => {
    if (!supportsMsds(item) || !hasMsds(item)) {
      toast.error('No MSDS attached');
      return;
    }

    setLoadingMsdsDownloadId(item.id);
    try {
      const signedUrl = await getSignedMsdsUrl(item.msds_current_id, 'download', { pin: pinInput || null });
      if (!signedUrl) throw new Error('Missing signed URL');
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('MSDS download error:', error);
      toast.error('Unable to open MSDS. Please try again.');
    } finally {
      setLoadingMsdsDownloadId(null);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-slate-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // PIN Entry Screen
  if (!isAuthenticated) {
    return (
      <div className="sml-root min-h-screen flex items-center justify-center p-3 sm:p-5">
        <style>{`
          .sml-root {
            overflow: hidden;
            background: #0f0608;
            font-family: 'DM Sans', sans-serif;
            position: relative;
          }
          .sml-bg {
            position: fixed;
            inset: 0;
            z-index: 0;
            overflow: hidden;
          }
          .sml-bg-base {
            position: absolute;
            inset: 0;
            background:
              radial-gradient(ellipse 70% 55% at 10% 15%, #4a0d1a 0%, transparent 55%),
              radial-gradient(ellipse 60% 50% at 90% 85%, #0d2e1c 0%, transparent 50%),
              radial-gradient(ellipse 40% 40% at 50% 50%, #1a0810 0%, transparent 65%),
              #0f0608;
          }
          .sml-grid {
            position: absolute;
            inset: 0;
            background-image:
              linear-gradient(rgba(201,168,76,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(201,168,76,0.03) 1px, transparent 1px);
            background-size: 56px 56px;
          }
          .sml-orb {
            position: absolute;
            border-radius: 9999px;
            filter: blur(90px);
            animation: sml-drift ease-in-out infinite alternate;
          }
          .sml-orb-1 {
            width: 550px;
            height: 550px;
            background: radial-gradient(circle, rgba(123,28,46,0.55), transparent 70%);
            top: -130px;
            left: -80px;
            animation-duration: 22s;
          }
          .sml-orb-2 {
            width: 600px;
            height: 600px;
            background: radial-gradient(circle, rgba(45,106,79,0.45), transparent 70%);
            bottom: -160px;
            right: -100px;
            animation-duration: 28s;
            animation-delay: -10s;
          }
          .sml-orb-3 {
            width: 350px;
            height: 350px;
            background: radial-gradient(circle, rgba(201,168,76,0.12), transparent 70%);
            top: 42%;
            left: 44%;
            animation-duration: 17s;
            animation-delay: -5s;
          }
          .sml-sweep {
            position: absolute;
            left: 0;
            right: 0;
            height: 1px;
            background: linear-gradient(90deg, transparent, rgba(201,168,76,0.2), transparent);
            animation: sml-sweep 14s linear infinite;
          }
          .sml-spore {
            position: absolute;
            border-radius: 9999px;
            opacity: 0;
            animation: sml-spore linear infinite;
          }
          .sml-botanical {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
          }
          .sml-card {
            position: relative;
            z-index: 10;
            width: min(900px, 95vw);
            min-height: 530px;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 40px 100px rgba(0,0,0,0.75), 0 0 0 1px rgba(201,168,76,0.15);
            animation: sml-rise 0.9s cubic-bezier(0.16,1,0.3,1) both;
          }
          .sml-left {
            background: linear-gradient(155deg, #5a1220 0%, #3d0c16 45%, #1f0a0e 100%);
            border-right: 1px solid rgba(201,168,76,0.1);
            position: relative;
            overflow: hidden;
          }
          .sml-left:before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2.5px;
            background: linear-gradient(90deg,#a32438,#c9a84c,#40916c,#c9a84c,#a32438);
            background-size: 200% 100%;
            animation: sml-shimmer 5s linear infinite;
          }
          .sml-right {
            background: #fdf6ec;
            position: relative;
            overflow: hidden;
          }
          .sml-right:before {
            content: '';
            position: absolute;
            inset: 0;
            background-image: radial-gradient(rgba(123,28,46,0.04) 1.5px, transparent 1.5px);
            background-size: 26px 26px;
          }
          .sml-right:after {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 2.5px;
            background: linear-gradient(90deg,#7b1c2e,#2d6a4f);
            opacity: .65;
          }
          .sml-pin {
            font-family: 'JetBrains Mono', monospace;
            letter-spacing: .35em;
            text-align: center;
            border-radius: 50px;
          }
          .sml-enter {
            border-radius: 50px;
            background: linear-gradient(135deg,#4e0f1c 0%,#a32438 60%,#8b2040 100%);
            box-shadow: 0 4px 20px rgba(123,28,46,0.45);
          }
          .sml-enter:hover {
            box-shadow: 0 8px 28px rgba(123,28,46,0.5);
          }
          @keyframes sml-drift {
            0% { transform: translate(0,0) scale(1); }
            40% { transform: translate(28px,-22px) scale(1.04); }
            100% { transform: translate(-18px,32px) scale(0.97); }
          }
          @keyframes sml-sweep {
            0% { top: -1px; }
            100% { top: 100%; }
          }
          @keyframes sml-spore {
            0% { opacity: 0; transform: translateY(0) rotate(0deg); }
            12% { opacity: 0.7; }
            88% { opacity: 0.25; }
            100% { opacity: 0; transform: translateY(-65vh) rotate(180deg); }
          }
          @keyframes sml-rise {
            from { opacity: 0; transform: translateY(44px) scale(0.96); }
            to { opacity: 1; transform: none; }
          }
          @keyframes sml-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
        <div className="sml-bg" aria-hidden>
          <div className="sml-bg-base" />
          <div className="sml-grid" />
          <div className="sml-orb sml-orb-1" />
          <div className="sml-orb sml-orb-2" />
          <div className="sml-orb sml-orb-3" />
          <div className="sml-sweep" />
          <svg
            className="sml-botanical"
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M60 900 C60 700 100 580 50 380 C20 250 70 120 35 20" stroke="rgba(45,106,79,0.3)" strokeWidth="2" fill="none" />
            <ellipse cx="40" cy="220" rx="72" ry="28" fill="rgba(45,106,79,0.25)" transform="rotate(-38 40 220)" />
            <ellipse cx="70" cy="340" rx="80" ry="30" fill="rgba(45,106,79,0.18)" transform="rotate(25 70 340)" />
            <ellipse cx="20" cy="480" rx="68" ry="26" fill="rgba(45,106,79,0.22)" transform="rotate(-50 20 480)" />
            <ellipse cx="90" cy="600" rx="75" ry="28" fill="rgba(45,106,79,0.15)" transform="rotate(18 90 600)" />
            <ellipse cx="30" cy="740" rx="65" ry="25" fill="rgba(45,106,79,0.20)" transform="rotate(-30 30 740)" />
            <ellipse cx="110" cy="130" rx="60" ry="22" fill="rgba(64,145,108,0.18)" transform="rotate(40 110 130)" />

            <path d="M1390 0 C1390 200 1350 340 1405 540 C1425 640 1385 760 1415 900" stroke="rgba(45,106,79,0.3)" strokeWidth="2" fill="none" />
            <ellipse cx="1400" cy="180" rx="78" ry="30" fill="rgba(45,106,79,0.22)" transform="rotate(35 1400 180)" />
            <ellipse cx="1370" cy="320" rx="82" ry="31" fill="rgba(45,106,79,0.18)" transform="rotate(-28 1370 320)" />
            <ellipse cx="1420" cy="460" rx="70" ry="27" fill="rgba(45,106,79,0.20)" transform="rotate(48 1420 460)" />
            <ellipse cx="1380" cy="600" rx="76" ry="29" fill="rgba(45,106,79,0.15)" transform="rotate(-20 1380 600)" />
            <ellipse cx="1410" cy="750" rx="66" ry="25" fill="rgba(64,145,108,0.18)" transform="rotate(32 1410 750)" />

            <ellipse cx="300" cy="80" rx="120" ry="18" fill="rgba(123,28,46,0.12)" transform="rotate(-15 300 80)" />
            <ellipse cx="1150" cy="820" rx="130" ry="20" fill="rgba(123,28,46,0.10)" transform="rotate(12 1150 820)" />
          </svg>
          {pinSpores.map((spore, idx) => (
            <div
              key={idx}
              className="sml-spore"
              style={{
                left: spore.left,
                bottom: spore.bottom,
                width: spore.size,
                height: spore.size,
                background: spore.color,
                animationDelay: spore.delay,
                animationDuration: spore.duration,
              }}
            />
          ))}
        </div>
        <div className="sml-card grid grid-cols-1 lg:grid-cols-[44%_56%]">
          <div className="sml-left hidden lg:flex p-10 text-white flex-col">
            <div className="relative z-10 h-full flex flex-col">
              <div className="mt-8">
                <h1 className="text-[1.65rem] font-bold tracking-tight leading-tight text-[#e8f0ff]" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Student Use Portal
                </h1>
                <p className="mt-3 text-[0.85rem] text-[#dcebff80] leading-7 max-w-md">
                  Record real-time laboratory item usage with guided access and controlled stock updates.
                </p>
              </div>
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3 text-[#dcebffb3]">
                  <FlaskConical className="w-5 h-5 text-[#c9a84c]" />
                  <span className="text-[0.86rem]">Use chemicals with live stock validation</span>
                </div>
                <div className="flex items-center gap-3 text-[#dcebffb3]">
                  <Package className="w-5 h-5 text-[#c9a84c]" />
                  <span className="text-[0.86rem]">Track consumables per student activity</span>
                </div>
                <div className="flex items-center gap-3 text-[#dcebffb3]">
                  <Clock className="w-5 h-5 text-[#c9a84c]" />
                  <span className="text-[0.86rem]">Auto-logged usage history with timestamps</span>
                </div>
              </div>
              <div className="mt-auto pt-8 border-t border-[#c9a84c14] flex items-center gap-2 text-xs text-[#c9a84c80]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                <ShieldCheck className="w-4 h-4 text-[#40916c]" />
                <span>PIN-protected student access</span>
              </div>
            </div>
          </div>
          <div className="sml-right p-6 sm:p-8 lg:p-12 flex items-center">
            <div className="relative z-10 w-full max-w-md mx-auto">
              <h2 className="text-[1.95rem] font-bold tracking-[-0.03em] leading-tight text-[#1a0a0e]" style={{ fontFamily: "'Playfair Display', serif" }}>
                Enter Lab Access
              </h2>
              <p className="text-[0.85rem] text-[#7a5a60] mt-1 mb-6">Use your lab PIN to continue</p>
              <div className="space-y-4">
                {pinError && (
                  <Alert variant="destructive" className="py-3 border-red-200 bg-red-50">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{pinError}</AlertDescription>
                  </Alert>
                )}
                <div>
                  <Label className="text-[0.8rem] font-semibold text-[#3a2028] mb-2 block tracking-[0.02em]">Lab PIN</Label>
                  <div className="relative">
                    <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-[#c0a0a8] pointer-events-none" />
                    <Input
                      type="password"
                      inputMode="numeric"
                      maxLength={10}
                      value={pinInput}
                      onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && verifyPin()}
                      placeholder="Enter PIN"
                      className="sml-pin pl-12 pr-5 h-[56px] border-2 border-[#e5d0d4] bg-white text-[#1a0a0e] text-lg placeholder:text-[#c0a8ae] focus:border-[#7b1c2e] focus:ring-4 focus:ring-[#7b1c2e1a]"
                      autoFocus
                    />
                  </div>
                </div>
                <Button
                  onClick={verifyPin}
                  disabled={isVerifying || !pinInput}
                  className="sml-enter w-full h-[52px] text-sm font-semibold text-[#f5e6c8] transition-all duration-200"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Enter Lab'
                  )}
                </Button>
                <p className="text-xs text-[#a08088] text-center">Contact your lab administrator if you need access.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Student Interface - Mobile First
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Compact Header */}
      <header className="sticky top-0 z-40 bg-gradient-to-r from-[#4e0f1c] via-[#7b1c2e] to-[#8f2437] backdrop-blur-md border-b border-[#c9a84c40] shadow-sm px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#f7f3ea] flex items-center justify-center shadow-md ring-1 ring-black/10">
              <img src="/logo.png" alt="System Logo" className="w-7 h-7 object-contain" />
            </div>
            <span className="font-bold text-slate-100">GMBD MBB Lab</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleEndSession}
            className="h-8 w-8 rounded-xl border border-[#f4efe766] text-[#7b1c2e] bg-[#fdf6ec] hover:bg-[#f7ead6]"
            aria-label="End session"
            title="End session"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 sm:py-6">
        {/* Page Title */}
        <h1 className="text-xl font-bold text-slate-900 mb-4">Record Item Usage</h1>

        {/* Search Input - Full Width */}
        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            ref={searchInputRef}
            placeholder="Search items by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 h-12 text-base border-slate-200 bg-white shadow-sm focus:shadow-md transition-shadow rounded-xl"
          />
          {isSearching && (
            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 animate-spin text-blue-500" />
          )}
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 mb-5 max-h-[50vh] overflow-y-auto shadow-md">
            {searchResults.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                onSelect={selectItem}
                getItemStatus={getItemStatus}
                onViewMsds={handleViewMsds}
                isViewingMsds={loadingMsdsViewId === item.id}
              />
            ))}
          </div>
        )}

        {searchQuery && searchResults.length === 0 && !isSearching && (
          <div className="text-center py-10 bg-white rounded-xl border border-slate-200">
            <Search className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No items found for "{searchQuery}"</p>
          </div>
        )}

        {/* Recent Items - Show when not searching */}
        {!searchQuery && recentItems.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-semibold text-slate-700">Recently Used</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearRecentItems}
                className="h-7 px-2 rounded-xl bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border border-[#c9a84c40] text-[#f4efe7] shadow-[0_6px_20px_rgba(123,28,46,0.28)] hover:brightness-110"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Clear
              </Button>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-md">
              {recentItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onSelect={selectItem}
                  getItemStatus={getItemStatus}
                  onViewMsds={handleViewMsds}
                  isViewingMsds={loadingMsdsViewId === item.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!searchQuery && recentItems.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">Search for an item</h3>
            <p className="text-slate-500 text-sm">Find items to record your usage</p>
          </div>
        )}
      </main>

      {/* Bottom Sheet for Item Usage */}
      <Drawer open={!!selectedItem} onOpenChange={(open) => !open && closeSheet()}>
        <DrawerContent className="max-h-[90vh]">
          <div className="mx-auto w-full max-w-lg">
            <DrawerHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedItem?.category === 'chemical' ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
                    {selectedItem?.category === 'chemical' ? (
                      <FlaskConical className="w-6 h-6 text-indigo-600" />
                    ) : (
                      <Package className="w-6 h-6 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <DrawerTitle className="text-left text-base">{selectedItem?.name}</DrawerTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-slate-600">
                        {selectedItem ? `${getAvailableForMode(selectedItem, deductMode)} ${getUnitForMode(selectedItem, deductMode)} available` : ''}
                      </span>
                      {(selectedItem?.room_area || selectedItem?.location) && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {formatLocation(selectedItem)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <DrawerClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <X className="w-4 h-4" />
                  </Button>
                </DrawerClose>
              </div>
              
              {/* Status badges */}
              {selectedItem && getItemStatus(selectedItem).length > 0 && (
                <div className="flex gap-1 mt-2">
                  {getItemStatus(selectedItem).map((status, idx) => (
                    <Badge key={idx} variant="outline" className={`text-xs ${status.color}`}>
                      {status.label}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">MSDS</p>
                {supportsMsds(selectedItem) && hasMsds(selectedItem) ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => handleViewMsds(selectedItem)}
                      disabled={loadingMsdsViewId === selectedItem.id}
                      aria-label={`View MSDS for ${selectedItem.name}`}
                    >
                      {loadingMsdsViewId === selectedItem.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      View MSDS
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => handleDownloadMsds(selectedItem)}
                      disabled={loadingMsdsDownloadId === selectedItem.id}
                      aria-label={`Download MSDS for ${selectedItem.name}`}
                    >
                      {loadingMsdsDownloadId === selectedItem.id ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Download
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">MSDS not available</p>
                )}
              </div>
            </DrawerHeader>

            <div className="px-4 pb-4 overflow-y-auto max-h-[60vh]">
              {selectedItem?.status === 'disposed' ? (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    This item is disposed and cannot be used.
                  </AlertDescription>
                </Alert>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {formError && (
                    <Alert variant="destructive" className="py-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{formError}</AlertDescription>
                    </Alert>
                  )}

                  {selectedItem?.tracking_type === 'PACK_WITH_CONTENT' && (
                    <div className="space-y-2">
                      <Label className="text-sm">Deduct By</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={deductMode === 'CONTENT' ? 'default' : 'outline'}
                          className={deductMode === 'CONTENT' ? 'bg-[#7b1c2e] hover:bg-[#671725]' : ''}
                          onClick={() => {
                            setDeductMode('CONTENT');
                            setQuantity(1);
                            setFormError('');
                          }}
                        >
                          Content ({selectedItem?.content_label || 'pcs'})
                        </Button>
                        <Button
                          type="button"
                          variant={deductMode === 'UNITS' ? 'default' : 'outline'}
                          className={deductMode === 'UNITS' ? 'bg-[#7b1c2e] hover:bg-[#671725]' : ''}
                          onClick={() => {
                            setDeductMode('UNITS');
                            setQuantity(1);
                            setFormError('');
                          }}
                        >
                          Full {selectedItem?.unit_type || 'pack'}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">
                        Sealed: {selectedItem?.sealed_count ?? 0} / Opened: {selectedItem?.opened_count ?? 0}
                      </p>
                    </div>
                  )}

                  {/* Quantity with +/- and quick buttons */}
                  <div>
                    <Label className="text-sm">Quantity *</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 flex-shrink-0"
                        onClick={() => adjustQuantity(-1)}
                        disabled={quantity <= 0}
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Input
                        type="number"
                        min={getTrackingType(selectedItem) === 'SIMPLE_MEASURE' ? '0.01' : '1'}
                        step={getTrackingType(selectedItem) === 'SIMPLE_MEASURE' ? '0.01' : '1'}
                        max={getAvailableForMode(selectedItem, deductMode)}
                        value={quantity}
                        onChange={(e) => {
                          const trackingType = getTrackingType(selectedItem);
                          const next = trackingType === 'SIMPLE_MEASURE'
                            ? parseFloat(e.target.value) || 0
                            : parseInt(e.target.value, 10) || 0;
                          setQuantity(next);
                        }}
                        className="text-center text-lg font-semibold h-10"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 flex-shrink-0"
                        onClick={() => adjustQuantity(1)}
                        disabled={selectedItem && quantity >= getAvailableForMode(selectedItem, deductMode)}
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                      <span className="text-slate-500 font-medium text-sm w-16">{getUnitForMode(selectedItem, deductMode)}</span>
                    </div>
                    
                    {/* Quick add buttons */}
                    <div className="flex gap-2 mt-2">
                      {selectedItem && getQuickButtons(getUnitForMode(selectedItem, deductMode)).map((val) => (
                        <Button
                          key={val}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-8"
                          onClick={() => adjustQuantity(val)}
                          disabled={selectedItem && quantity + val > getAvailableForMode(selectedItem, deductMode)}
                        >
                          +{val}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Student Name */}
                  <div>
                    <Label htmlFor="student_name" className="text-sm">Your Name *</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        id="student_name"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="Enter your name"
                        className="pl-9 h-10"
                      />
                    </div>
                  </div>

                  {/* Optional fields in a row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="student_id" className="text-xs text-slate-500">Student ID</Label>
                      <div className="relative mt-1">
                        <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                          id="student_id"
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          placeholder="Optional"
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="experiment" className="text-xs text-slate-500">Experiment</Label>
                      <div className="relative mt-1">
                        <FileText className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                          id="experiment"
                          value={experiment}
                          onChange={(e) => setExperiment(e.target.value)}
                          placeholder="Optional"
                          className="pl-8 h-9 text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <Label htmlFor="notes" className="text-xs text-slate-500">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes..."
                      rows={2}
                      className="mt-1 text-sm"
                    />
                  </div>
                </form>
              )}
            </div>

            {/* Sticky Submit Button */}
            {selectedItem?.status !== 'disposed' && (
              <div className="sticky bottom-0 p-4 bg-white border-t">
                <Button 
                  onClick={handleSubmit}
                  className="w-full h-12 text-base font-semibold rounded-xl bg-gradient-to-r from-[#7b1c2e] to-[#8f2437] border border-[#c9a84c40] text-[#f4efe7] shadow-[0_6px_20px_rgba(123,28,46,0.28)] hover:brightness-110" 
                  disabled={isSubmitting || quantity <= 0 || (selectedItem && quantity > getAvailableForMode(selectedItem, deductMode))}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Recording...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-5 h-5 mr-2" />
                      Record Usage
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      <MsdsViewerModal
        open={msdsViewerOpen}
        onClose={() => {
          setMsdsViewerOpen(false);
          setMsdsViewerUrl(null);
        }}
        title={msdsViewerTitle}
        signedUrl={msdsViewerUrl}
      />
    </div>
  );
}

// Extracted Item Row Component
function ItemRow({ item, onSelect, getItemStatus, onViewMsds, isViewingMsds }) {
  const statuses = getItemStatus(item);
  const isDisposed = item.status === 'disposed';
  const supportsMsds = item?.category === 'chemical' || Boolean(item?.msds_current_id);
  const hasMsds = Boolean(item?.msds_current_id);
  const trackingType = item?.tracking_type || 'SIMPLE_MEASURE';
  const stockText = trackingType === 'SIMPLE_MEASURE'
    ? `${item?.quantity_value ?? item?.quantity ?? 0} ${item?.quantity_unit || item?.unit || ''}`
    : trackingType === 'UNIT_ONLY'
      ? `${item?.total_units ?? item?.quantity ?? 0} ${item?.unit_type || item?.unit || 'unit'}`
      : `${item?.total_units ?? item?.quantity ?? 0} ${item?.unit_type || item?.unit || 'pack'} - ${item?.total_content ?? 0} ${item?.content_label || 'pcs'}`;
  
  return (
    <div className={`w-full flex items-center gap-2 pr-2 transition-all duration-200 hover:bg-slate-50 active:bg-slate-100 ${isDisposed ? 'opacity-50' : ''}`}>
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="flex-1 p-3.5 text-left flex items-center gap-3 min-w-0"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${item.category === 'chemical' ? 'bg-indigo-100' : 'bg-emerald-100'}`}>
          {item.category === 'chemical' ? (
            <FlaskConical className="w-5 h-5 text-indigo-600" />
          ) : (
            <Package className="w-5 h-5 text-emerald-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="font-medium">{stockText}</span>
            {(item.room_area || item.location) && (
              <>
                <span className="text-slate-300">|</span>
                <span className="truncate">{formatLocation(item)}</span>
              </>
            )}
          </div>
        </div>
      </button>

      <div className="flex items-center gap-1">
        {statuses.length > 0 && (
          <div className="flex-shrink-0">
            {statuses.slice(0, 1).map((status, idx) => (
              <Badge key={idx} variant="outline" className={`text-xs px-2 py-0.5 font-medium ${status.color}`}>
                {status.label}
              </Badge>
            ))}
          </div>
        )}

        {supportsMsds && (
          <TooltipProvider delayDuration={120}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className={`h-8 w-8 rounded-lg ${hasMsds ? 'text-slate-500 hover:text-slate-700' : 'text-slate-300 hover:text-slate-300'}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!hasMsds) return;
                    onViewMsds?.(item);
                  }}
                  disabled={isViewingMsds}
                  aria-disabled={!hasMsds}
                  aria-label={hasMsds ? `View MSDS for ${item.name}` : `No MSDS attached for ${item.name}`}
                >
                  {isViewingMsds ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {hasMsds ? 'View MSDS' : 'No MSDS attached'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}







