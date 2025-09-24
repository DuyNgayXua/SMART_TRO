import React, { useEffect } from "react"
import Header from "../common/header/Header"
import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import Home from "../home/Home"
import Footer from "../common/footer/Footer"
import About from "../about/About"
import Pricing from "../pricing/Pricing"
import Blog from "../blog/Blog"
import Services from "../services/Services"
import Contact from "../contact/Contact"
import Login from "../auth/Login"
import Register from "../auth/Register"
import ForgotPassword from "../auth/ForgotPassword"
import VerifyEmail from "../auth/VerifyEmail"
import ProtectedRoute from "../auth/ProtectedRoute"
import Dashboard from "../admin/dashboard/Dashboard"
import PropertyManagement from "../admin/properties/PropertyManagement"
import RoomsManagement from "../admin/rooms/RoomsManagement"
import AmenitiesManagement from "../admin/amenities/AmenitiesManagement"
import Tenants from "../admin/tenants/TenantsManagement"
import Contracts from "../admin/contracts/ContractsManagement"
import Settings from "../admin/settings/Settings"
import ProfileLayout from "../profile/ProfileLayout"
import AccountManagement from "../profile/account-management/AccountManagement"
import NewPost from "../profile/new-property/NewProperty"
import MyPosts from "../profile/my-properties/MyProperties.jsx"
import Favorites from "../profile/favorites/Favorites"
import PaymentHistory from "../profile/payment-history/PaymentHistory"
import PricingProfile from "../profile/pricing/Pricing"
import PropertiesListing from "../properties/PropertiesListing"
import PropertyDetail from "../properties/PropertyDetail"
import PageTitleWrapper from "../common/PageTitleWrapper"
import { ToastContainer, toast } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const Pages = () => {
  // Set up global notification handler
  useEffect(() => {
    window.showLogoutNotification = (message) => {
      toast.warning(message, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    };

    // Cleanup
    return () => {
      delete window.showLogoutNotification;
    };
  }, []);


  return (
    <>
      <Router>
        <PageTitleWrapper>
          <Routes>
          {/* User pages with Header and Footer */}
          <Route path='/' element={
            <>
              <Header />
              <Home />
              <Footer />
            </>
          } />
          <Route path='/about' element={
            <>
              <Header />
              <About />
              <Footer />
            </>
          } />
          <Route path='/services' element={
            <>
              <Header />
              <Services />
              <Footer />
            </>
          } />
          <Route path='/blog' element={
            <>
              <Header />
              <Blog />
              <Footer />
            </>
          } />
          <Route path='/pricing' element={
            <>
              <Header />
              <Pricing />
              <Footer />
            </>
          } />
          <Route path='/contact' element={
            <>
              <Header />
              <Contact />
              <Footer />
            </>
          } />
          <Route path='/properties' element={
            <>
              <Header />
              <PropertiesListing />
              <Footer />
            </>
          } />
          <Route path='/properties/:id' element={
            <>
              <Header />
              <PropertyDetail />
              <Footer />
            </>
          } />
          <Route path='/login' element={
            <>
              <Header />
              <Login />
              <Footer />
            </>
          } />
          <Route path='/register' element={
            <>
              <Header />
              <Register />
              <Footer />
            </>
          } />
          <Route path='/forgot-password' element={
            <>
              <Header />
              <ForgotPassword />
              <Footer />
            </>
          } />
          <Route path='/verify-email' element={
            <>
              <Header />
              <VerifyEmail />
              <Footer />
            </>
          } />

          {/* Profile pages with Header */}
          <Route path='/profile' element={
            <ProtectedRoute>
              <Header />
              <ProfileLayout />
            </ProtectedRoute>
          }>
            <Route path='account' element={<AccountManagement />} />
            <Route path='new-post' element={<NewPost />} />
            <Route path='my-posts' element={<MyPosts />} />
            <Route path='favorites' element={<Favorites />} />
            <Route path='payment-history' element={<PaymentHistory />} />
            <Route path='pricing' element={<PricingProfile />} />
            <Route index element={<AccountManagement />} />
          </Route>

          {/* Admin pages without Header and Footer */}
          <Route path='/admin/dashboard' element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path='/admin/properties' element={<ProtectedRoute><PropertyManagement /></ProtectedRoute>} />
          <Route path='/admin/rooms' element={<ProtectedRoute><RoomsManagement /></ProtectedRoute>} />
          <Route path='/admin/amenities' element={<ProtectedRoute><AmenitiesManagement /></ProtectedRoute>} />
          <Route path='/admin/settings' element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path='/admin/tenants' element={<ProtectedRoute><Tenants /></ProtectedRoute>} />
          <Route path='/admin/contracts' element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
        </Routes>
        </PageTitleWrapper>
      </Router>
      
      {/* Global ToastContainer */}
      <ToastContainer 
        position="top-right"
        autoClose={2000}
        hideProgressBar={false}
        closeOnClick
        pauseOnHover
        draggable
        theme="light"
        style={{ zIndex: 9999, marginTop: '70px' }}
      />
    </>
  )
}

export default Pages