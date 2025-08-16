import React from "react"
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
import Dashboard from "../admin/dashboard/Dashboard"
import RoomsManagement from "../admin/rooms/RoomsManagement"
import Settings from "../admin/settings/Settings"
import PageTitleWrapper from "../common/PageTitleWrapper"

const Pages = () => {
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

          {/* Admin pages without Header and Footer */}
          <Route path='/admin/dashboard' element={<Dashboard />} />
          <Route path='/admin/rooms' element={<RoomsManagement />} />
          <Route path='/admin/settings' element={<Settings />} />
        </Routes>
        </PageTitleWrapper>
      </Router>
    </>
  )
}

export default Pages
