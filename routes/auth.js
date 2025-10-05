const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const User = require("../models/User.js")
const dotenv = require("dotenv")
const router = express.Router()
dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET

router.post("/register", async(req, res) => {
    const {username, password} = req.body

    try {
        const existingUser = await User.findOne({username})
        if(existingUser){
            return res.status(400).json({success: false, message: "User Already exists. Please Login."})
        }
        const salt = await bcrypt.genSalt(10)
        const hashPassword = await bcrypt.hash(password, salt)
        const user = new User({username: username, password: hashPassword})
        await user.save()

        const token = jwt.sign({id: user._id}, JWT_SECRET, {expiresIn: "4h"})
        return res.status(200).json({success: true, message: "User registerd successfully", data: user, token})
    } catch (error) {
        return res.status(500).json({success: false, message: "Server Error", error: error})
    }
})

router.post("/login", async (req, res) => {
    const {username, password} = req.body

    try {
        const user = await User.findOne({username})
        if(!user){
            return res.status(404).json({success: false, message: "User Not Found"})
        }
        const isPasswordMatch = await user.comparePassword(password)
        if(!isPasswordMatch){
            return res.status(400).json({success: false, message: "Invalid Credentials"})
        }

        return res.status(200).json({success: true, message: "Login Successfully", username: user.username})
    } catch (error) {
        return res.status(500).json({success: false, message: error.message})
    }
})

module.exports = router
