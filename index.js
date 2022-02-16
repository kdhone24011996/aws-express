const express = require('express')
const app = express()

app.use('/test', (req, res,next)=>{
    res.send('success')
})



app.listen(process.env.PORT || 8001)

