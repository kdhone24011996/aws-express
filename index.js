const express = require('express')
const app = express()

app.use('/test', (req, res,next)=>{
    res.send(`server is running on port ${process.env.PORT}`)
})

const port = process.env.PORT || 8001

app.listen(port)

