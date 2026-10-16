逐点 SA-PINN（``pointwise_self_adaptive``）
================================================================

.. openpinn-method-summary:: adaptive_weights pointwise_self_adaptive

大白话
------

每个 PDE、边界和初值训练点都有自己的正权重。网络参数做梯度下降，点权重做梯度
上升，所以当前误差非零的点会获得更高关注。这才是论文的逐配点版本；旧
``self_adaptive`` 只是每个损失项一个标量，二者必须分开。

放在哪里与怎么调用
------------------

``formulations.py`` 输出逐点损失，``losses.py`` 的
``PointwiseAdaptiveLossComposer`` 管理点权重，二级入口为
``methods/adaptive_weights/pointwise_self_adaptive.py``。

.. code-block:: python

   result = op.solve(
       "burgers", method="adaptive_weights",
       variant="pointwise_self_adaptive", steps=5000,
   )

论文、代码与许可
------------------------------

依据 McClenny and Braga-Neto (2023), *Self-adaptive physics-informed neural
networks*, DOI ``10.1016/j.jcp.2022.111722``。仓库
``https://github.com/levimcclenny/SA-PINNs`` 未检测到明确许可证，本实现按论文
鞍点公式独立编写，没有复制源码。

300 步 Burgers 参考短跑与失败说明
------------------------------------------------

48 个 PDE 点、12 个边界点、12 个初值点共增加 72 个点权重。PDE 残差从
0.24593 降到 0.21595，但相对 L2 从 0.54796 **变差** 到 0.57857，边界/初值
RMSE 也更差，用时从 0.1961 s 增至 0.3499 s。这是混合且总体不占优的短跑，
完整记录位于
``results/method_expansions/20260829/adaptive_weights/pointwise_self_adaptive/``。
