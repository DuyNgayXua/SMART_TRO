import {
  Drawer,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Box,
  Typography,
  Avatar,
  Divider,
} from "@mui/material";
import {
  Dashboard,
  ExpandLess,
  ExpandMore,
  ArrowRight,
  Settings,
  House,
  People,
  EditDocument,
  Category,
  Report,
  WorkspacePremium,
  Payment,
  Redeem
} from "@mui/icons-material";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from 'react-i18next';

// Import Google Fonts for Vietnamese and English support
const fontFamily = "'Inter', 'Segoe UI', 'Roboto', 'Noto Sans', -apple-system, BlinkMacSystemFont, sans-serif";

// Simple module-level cache so profile only fetched once per token during session
let __cachedUserProfile = null; // { fullName, avatar, role, token }
let __isLoading = false; // Prevent multiple concurrent fetches

const SideBar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [openMenus, setOpenMenus] = useState({});
  const [fullName, setFullName] = useState("...");
  const [avatar, setAvatar] = useState("");
  const [role, setRole] = useState("");
  const [loadingUser, setLoadingUser] = useState(true);

  // Định nghĩa tất cả menu items với roles được phép truy cập
  const allMenuItems = useMemo(() => [
    { text: t('sidebar.dashboard'), icon: <Dashboard />, path: "/admin/dashboard", roles: ['admin', 'landlord'] },
    { text: t('sidebar.rooms'), icon: <House />, path: "/admin/rooms", roles: ['landlord'] },
    { text: t('sidebar.amenities'), icon: <Category />, path: "/admin/amenities", roles: ['landlord'] },
    { text: t('sidebar.tenants'), icon: <People />, path: "/admin/tenants", roles: ['landlord'] },
    { text: t('sidebar.contracts'), icon: <EditDocument />, path: "/admin/contracts", roles: ['landlord'] },
    { text: t('sidebar.payments'), icon: <Payment />, path: "/admin/payments", roles: ['landlord'] },
    { text: t('sidebar.users'), icon: <People />, path: "/admin/users", roles: ['admin'] },
    { text: t('sidebar.properties'), icon: <EditDocument />, path: "/admin/properties", roles: ['admin'] },
    { text: t('sidebar.report-properties'), icon: <Report />, path: "/admin/report-properties", roles: ['admin'] },
    { text: t('sidebar.properties-packages'), icon: <WorkspacePremium />, path: "/admin/properties-packages", roles: ['admin'] },
    { text: t('sidebar.package-plans'), icon: <Redeem />, path: "/admin/package-plans", roles: ['admin'] },
    { text: t('sidebar.package-payments'), icon: <Payment />, path: "/admin/package-payments", roles: ['admin'] },
    { text: t('sidebar.settings'), icon: <Settings />, path: "/admin/settings", roles: ['admin', 'landlord'] }
  ], [t]);

  // Lọc menu items dựa trên role của user
  const menuItems = useMemo(() => {
    if (!role) return allMenuItems; // Hiển thị tất cả nếu chưa load role
    
    return allMenuItems.filter(item => {
      if (!item.roles) return true; // Hiển thị item nếu không có giới hạn role
      return item.roles.includes(role);
    });
  }, [allMenuItems, role]);

  // Load current user profile - only once per token
  useEffect(() => {
    const token = localStorage.getItem('token') || null;

    // If we have cached data for this token, use it immediately
    if (__cachedUserProfile && __cachedUserProfile.token === token) {
      const { fullName: cName, avatar: cAvatar, role: cRole } = __cachedUserProfile;
      setFullName(cName);
      setAvatar(cAvatar);
      setRole(cRole);
      setLoadingUser(false);
      return;
    }

    // If already loading, don't start another fetch
    if (__isLoading) {
      return;
    }

    // Start loading
    __isLoading = true;
    setLoadingUser(true);

    (async () => {
      try {
        // Always try to call API, even without token (for bypass mode)
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'}/users/profile`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!res.ok) {
          // If we had a token but request failed, try without token
          if (token) {
            const fallbackRes = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'}/users/profile`);
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              if (fallbackData.success && fallbackData.data) {
                const u = {
                  fullName: fallbackData.data.fullName || 'User',
                  avatar: fallbackData.data.avatar || '',
                  role: fallbackData.data.role || '',
                  token: null
                };
                __cachedUserProfile = u;
                setFullName(u.fullName);
                setAvatar(u.avatar);
                setRole(u.role);
                setLoadingUser(false);
                return;
              }
            }
          }
          throw new Error('Failed profile');
        }

        const data = await res.json();
        if (data.success && data.data) {
          const u = {
            fullName: data.data.fullName || 'User',
            avatar: data.data.avatar || '',
            role: data.data.role || '',
            token
          };
          __cachedUserProfile = u;
          setFullName(u.fullName);
          setAvatar(u.avatar);
          setRole(u.role);
        }
      } catch (e) {
        console.warn('Failed to load user profile:', e.message);
        // Use fallback data
        const fallbackName = localStorage.getItem('fallbackFullName') || 'Landlord';
        const fallbackRole = localStorage.getItem('role') || 'landlord';

        setFullName(fallbackName);
        setRole(fallbackRole);
      } finally {
        setLoadingUser(false);
        __isLoading = false;
      }
    })();
  }, []); // Empty dependency array - only run once when component mounts

  // Auto expand menu based on current path
  useEffect(() => {
    const currentPath = location.pathname;
    menuItems.forEach((item) => {
      if (item.isParent && item.subMenus) {
        item.subMenus.forEach((subItem) => {
          if (currentPath.startsWith(subItem.path)) {
            setOpenMenus((prev) => ({ ...prev, [item.text]: true }));
          }
        });
      }
    });
  }, [location.pathname, menuItems]);

  const toggleMenu = (menu) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  const isActiveParentRoute = (subMenus) => {
    return subMenus.some((subItem) => location.pathname.startsWith(subItem.path));
  };

  // Function to get initials from full name
  const getInitials = (name) => {
    if (!name) return "AU";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 280,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 280,
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          color: "#FFFFFF",
          boxShadow: "4px 0 20px rgba(0,0,0,0.15)",
          overflowX: "hidden",
          borderRight: "none",
        },
      }}
    >
      <Toolbar sx={{
        display: "flex",
        flexDirection: "column",
        py: 2.5,
        background: "rgba(255, 255, 255, 0.08)",
        backdropFilter: "blur(10px)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
        minHeight: "200px"
      }}>
        <Box sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          mb: 1.5,
          width: "100%"
        }}>
          {avatar ? (
            <Avatar
              src={avatar}
              alt={fullName}
              sx={{
                width: 70,
                height: 70,
                mb: 1.5,
                border: "3px solid rgba(255,255,255,0.3)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                transition: "transform 0.2s ease",
                "&:hover": {
                  transform: "scale(1.05)"
                }
              }}
            />
          ) : (
            <Avatar
              sx={{
                width: 70,
                height: 70,
                mb: 1.5,
                bgcolor: "rgba(255,255,255,0.2)",
                fontSize: 28,
                fontWeight: 700,
                border: "3px solid rgba(255,255,255,0.3)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                transition: "transform 0.2s ease",
                "&:hover": {
                  transform: "scale(1.05)"
                }
              }}
            >
              {getInitials(fullName)}
            </Avatar>
          )}
          <Typography
            variant="h6"
            sx={{
              fontFamily: fontFamily,
              fontWeight: 600,
              letterSpacing: 0.3,
              textShadow: "0 2px 4px rgba(0,0,0,0.3)",
              mb: 0.5,
              background: "linear-gradient(45deg, #ffffff, #f0f0f0)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontSize: "1.1rem"
            }}
          >
            {loadingUser ? t('common.loading') : fullName}
          </Typography>
          <Box sx={{
            background: "rgba(255,255,255,0.15)",
            px: 1.5,
            py: 0.3,
            borderRadius: 1.5,
            backdropFilter: "blur(10px)",
            mb: 1
          }}>
            <Typography
              variant="caption"
              sx={{
                fontFamily: fontFamily,
                opacity: 0.9,
                fontWeight: 500,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                fontSize: "0.65rem"
              }}
            >
              {loadingUser ? '...' : (role ? t(`roles.${role}`, { defaultValue: role }) : t('auth.administrator'))}
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      <Divider sx={{
        bgcolor: "rgba(255,255,255,0.2)",
        mx: 0,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }} />

      <List sx={{ px: 2, pt: 2, pb: 1 }}>
        {menuItems.map((item, index) => (
          <div key={index}>
            {item.isParent ? (
              <>
                <ListItem disablePadding sx={{ display: "block", mb: 0.8 }}>
                  <ListItemButton
                    onClick={() => toggleMenu(item.text)}
                    sx={{
                      borderRadius: 2.5,
                      py: 1.2,
                      px: 2,
                      mb: 0.3,
                      backgroundColor: isActiveParentRoute(item.subMenus)
                        ? "rgba(255,255,255,0.2)"
                        : "rgba(255,255,255,0.05)",
                      "&:hover": {
                        backgroundColor: "rgba(255,255,255,0.25)",
                        transform: "translateX(3px)",
                        boxShadow: "0 3px 10px rgba(0,0,0,0.15)"
                      },
                      transition: "all 0.3s ease",
                      border: "1px solid rgba(255,255,255,0.1)",
                      backdropFilter: "blur(10px)"
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: isActiveParentRoute(item.subMenus) ? "#fff" : "rgba(255,255,255,0.8)",
                        minWidth: "40px"
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.text}
                      primaryTypographyProps={{
                        fontFamily: fontFamily,
                        fontSize: 14,
                        fontWeight: isActiveParentRoute(item.subMenus) ? 600 : 400,
                        letterSpacing: 0.2,
                      }}
                    />
                    {openMenus[item.text] ?
                      <ExpandLess sx={{ color: "rgba(255,255,255,0.9)" }} /> :
                      <ExpandMore sx={{ color: "rgba(255,255,255,0.9)" }} />
                    }
                  </ListItemButton>
                </ListItem>
                <Collapse
                  in={openMenus[item.text]}
                  timeout="auto"
                  unmountOnExit
                >
                  <List component="div" disablePadding sx={{ pl: 1, mb: 1 }}>
                    {item.subMenus.map((subItem, subIndex) => (
                      <ListItem key={subIndex} disablePadding sx={{ display: "block", mb: 0.5 }}>
                        <ListItemButton
                          onClick={() => navigate(subItem.path)}
                          sx={{
                            pl: 4,
                            py: 1,
                            borderRadius: 2.5,
                            backgroundColor: isActiveRoute(subItem.path)
                              ? "rgba(255,255,255,0.25)"
                              : "rgba(255,255,255,0.05)",
                            "&:hover": {
                              backgroundColor: "rgba(255,255,255,0.2)",
                              transform: "translateX(6px)",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                            },
                            transition: "all 0.3s ease",
                            border: "1px solid rgba(255,255,255,0.08)"
                          }}
                        >
                          <ListItemIcon
                            sx={{
                              color: isActiveRoute(subItem.path) ? "#fff" : "rgba(255,255,255,0.7)",
                              minWidth: "35px",
                              ml: -0.5,
                            }}
                          >
                            <ArrowRight fontSize="small" />
                          </ListItemIcon>
                          <ListItemText
                            primary={subItem.text}
                            primaryTypographyProps={{
                              fontFamily: fontFamily,
                              fontSize: 14,
                              fontWeight: isActiveRoute(subItem.path) ? 500 : 400,
                              letterSpacing: 0.2,
                              color: isActiveRoute(subItem.path) ? "#fff" : "rgba(255,255,255,0.9)",
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Collapse>
              </>
            ) : (
              <ListItem disablePadding sx={{ display: "block", mb: 0.8 }}>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  sx={{
                    borderRadius: 2.5,
                    py: 1.2,
                    px: 2,
                    backgroundColor: isActiveRoute(item.path)
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(255,255,255,0.05)",
                    "&:hover": {
                      backgroundColor: "rgba(255,255,255,0.25)",
                      transform: "translateX(3px)",
                      boxShadow: "0 3px 10px rgba(0,0,0,0.15)"
                    },
                    transition: "all 0.3s ease",
                    border: "1px solid rgba(255,255,255,0.1)",
                    backdropFilter: "blur(10px)"
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: isActiveRoute(item.path) ? "#fff" : "rgba(255,255,255,0.8)",
                      minWidth: "40px"
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={item.text}
                    primaryTypographyProps={{
                      fontFamily: fontFamily,
                      fontSize: 14,
                      fontWeight: isActiveRoute(item.path) ? 600 : 400,
                      letterSpacing: 0.2,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            )}
          </div>
        ))}
      </List>

      <Box sx={{ flexGrow: 1 }} />

      <Box sx={{
        p: 3,
        background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
        borderTop: "1px solid rgba(255,255,255,0.15)",
        backdropFilter: "blur(10px)",
        mt: 2,
        mx: 2,
        mb: 2,
        borderRadius: 2,
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
      }}>
        <Typography variant="caption" sx={{
          fontFamily: fontFamily,
          opacity: 0.7,
          display: "block",
          textAlign: "center",
          fontSize: "0.75rem",
          fontWeight: 400,
          letterSpacing: 0.3
        }}>
          v1.0.0 • © {new Date().getFullYear()} SMART TRO
        </Typography>
      </Box>
    </Drawer>
  );
};

export default SideBar;